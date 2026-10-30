/**
 * My To-Do Application
 * Features:
 * - Task CRUD with persistence (localStorage)
 * - Separation of Active Tasks and Completed Tasks (Accordion)
 * - Priority, Due-Date (D-Day indicator), Category Tags
 * - Real-time Progress Bar & Statistics
 * - Search, Filter, Sort
 * - Detailed Edit Modal
 * - Dark / Light Theme Toggle
 * - Accessible Toast Notifications
 */

// Storage Keys
const STORAGE_KEY = 'todo_app_tasks_v1';
const THEME_KEY = 'todo_theme_mode';

// Initial Sample Data for First-time Users
const INITIAL_SAMPLE_TASKS = [
  {
    id: 'sample-1',
    title: '할 일 관리 앱 둘러보기 및 기능 확인',
    completed: false,
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    completedAt: null,
    priority: 'high',
    dueDate: new Date().toISOString().split('T')[0],
    category: '업무',
    memo: '우선순위, 마감일, 카테고리 태그 기능을 확인해보세요.'
  },
  {
    id: 'sample-2',
    title: '새로운 할 일 등록해보기 (Enter 키 활용)',
    completed: false,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    completedAt: null,
    priority: 'medium',
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
    category: '공부',
    memo: '상단 입력창에서 내용을 적고 Enter를 치면 빠르게 등록됩니다.'
  },
  {
    id: 'sample-3',
    title: '완료한 목록 하단 조회 기능 확인하기',
    completed: true,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    completedAt: new Date(Date.now() - 1800000).toISOString(),
    priority: 'low',
    dueDate: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    category: '개인',
    memo: '체크된 일은 이렇게 아래 완료 목록에 보관되며, 언제든 다시 클릭해 복원할 수 있습니다.'
  }
];

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
  // Theme
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
   Helper Functions
   ========================================================================== */

function saveTasks() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.tasks));
  } catch (err) {
    console.error('LocalStorage 저장 실패:', err);
  }
}

function loadTasks() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      state.tasks = JSON.parse(data);
    } else {
      state.tasks = [...INITIAL_SAMPLE_TASKS];
      saveTasks();
    }
  } catch (err) {
    console.error('LocalStorage 불러오기 실패:', err);
    state.tasks = [...INITIAL_SAMPLE_TASKS];
  }
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

// Calculate D-Day Badge
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
   Task Operations (CRUD)
   ========================================================================== */

function addTask(title, priority, dueDate, category) {
  const newTask = {
    id: 'task-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
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
  saveTasks();
  renderApp();
  showToast('새 할 일이 등록되었습니다.', 'success');
}

function toggleTask(id) {
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

  saveTasks();
  renderApp();
}

function deleteTask(id) {
  const taskIndex = state.tasks.findIndex(t => t.id === id);
  if (taskIndex === -1) return;

  const title = state.tasks[taskIndex].title;
  state.tasks.splice(taskIndex, 1);
  saveTasks();
  renderApp();
  showToast(`'${title}' 삭제되었습니다.`, 'danger');
}

function clearAllCompleted() {
  const completedCount = state.tasks.filter(t => t.completed).length;
  if (completedCount === 0) return;

  if (confirm(`완료된 할 일 ${completedCount}개를 모두 삭제하시겠습니까?`)) {
    state.tasks = state.tasks.filter(t => !t.completed);
    saveTasks();
    renderApp();
    showToast(`완료된 항목 ${completedCount}개가 정리되었습니다.`, 'danger');
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

function handleEditFormSubmit(e) {
  e.preventDefault();
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

  saveTasks();
  closeEditModal();
  renderApp();
  showToast('할 일이 성공적으로 수정되었습니다.', 'success');
}

/* ==========================================================================
   Filter & Sorting Logic
   ========================================================================== */

function getFilteredAndSortedTasks() {
  let list = [...state.tasks];

  // 1. Search Query Filter
  if (state.searchQuery.trim()) {
    const q = state.searchQuery.trim().toLowerCase();
    list = list.filter(t => 
      t.title.toLowerCase().includes(q) ||
      (t.memo && t.memo.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q))
    );
  }

  // 2. Sorting
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

  // Checkbox SVG
  const checkSvg = `
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
  `;

  // Priority Label
  const priorityLabels = { high: '높음 🔥', medium: '보통', low: '낮음 ☕' };
  const priorityClass = `badge-priority-${task.priority || 'medium'}`;

  // D-Day Badge
  const ddayInfo = getDDayInfo(task.dueDate);
  const ddayBadgeHtml = ddayInfo 
    ? `<span class="badge badge-dday ${ddayInfo.className}">📅 ${ddayInfo.text}</span>` 
    : '';

  // Category Badge
  const categoryBadgeHtml = task.category 
    ? `<span class="badge badge-category">🏷️ ${escapeHtml(task.category)}</span>` 
    : '';

  // Completed Timestamp (for completed items)
  const completedTimeHtml = task.completed && task.completedAt 
    ? `<span class="completed-timestamp">✓ ${formatDateTimeShort(task.completedAt)} 완료</span>` 
    : '';

  // Memo snippet
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

  // Attach event listeners to this item's actions
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

  // Update Badges Count
  elements.activeCountBadge.textContent = `(${activeTasks.length})`;
  elements.completedCountBadge.textContent = `(${completedTasks.length})`;

  // Clear completed button visibility
  elements.clearCompletedBtn.style.display = completedTasks.length > 0 ? 'inline-block' : 'none';

  // Handling Tab Filter View Mode
  if (state.currentFilter === 'active') {
    elements.activeSection.style.display = 'block';
    elements.completedSection.style.display = 'none';
  } else if (state.currentFilter === 'completed') {
    elements.activeSection.style.display = 'none';
    elements.completedSection.style.display = 'block';
  } else {
    // 'all'
    elements.activeSection.style.display = 'block';
    elements.completedSection.style.display = 'block';
  }

  // 1. Render Active Tasks
  elements.activeTasksList.innerHTML = '';
  if (activeTasks.length === 0) {
    elements.activeTasksList.innerHTML = `
      <div class="empty-state">
        <svg class="empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <polyline points="12 6 12 12 14 14"></polyline>
        </svg>
        <p class="empty-text">${state.searchQuery ? '검색 결과가 없습니다.' : '진행 중인 할 일이 없습니다. 새로운 할 일을 추가해보세요!'}</p>
      </div>
    `;
  } else {
    activeTasks.forEach(task => {
      elements.activeTasksList.appendChild(createTaskItemElement(task));
    });
  }

  // 2. Render Completed Tasks (Bottom Section)
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
   Theme & Event Handlers Setup
   ========================================================================== */

function setupTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
  applyTheme(savedTheme, false);

  elements.themeToggleBtn.addEventListener('click', () => {
    // 3가지 테마 순환: light -> dark -> sepia -> light
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

function applyTheme(theme, isUserAction = false) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);

  // 모든 아이콘 숨김 처리 후 해당하는 아이콘만 표시
  elements.moonIcon.style.display = 'none';
  elements.sunIcon.style.display = 'none';
  elements.coffeeIcon.style.display = 'none';

  if (theme === 'light') {
    // 라이트 모드일 때: 다음인 다크 모드로의 전환을 안내하는 달 아이콘 표시
    elements.moonIcon.style.display = 'block';
    elements.themeToggleBtn.title = '다크 모드로 전환';
  } else if (theme === 'dark') {
    // 다크 모드일 때: 다음인 세피아(웜) 모드로의 전환을 안내하는 커피 아이콘 표시
    elements.coffeeIcon.style.display = 'block';
    elements.themeToggleBtn.title = '세피아(아이케어 웜) 모드로 전환';
  } else if (theme === 'sepia') {
    // 세피아 모드일 때: 다음인 라이트 모드로의 전환을 안내하는 해 아이콘 표시
    elements.sunIcon.style.display = 'block';
    elements.themeToggleBtn.title = '라이트 모드로 전환';
  }
}

function setupEventListeners() {
  // 1. Add Task Form Submit
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

  // 2. Filter Tabs
  elements.tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      elements.tabButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.currentFilter = btn.dataset.filter;
      renderApp();
    });
  });

  // 3. Search Input
  elements.searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value;
    renderApp();
  });

  // 4. Sort Select
  elements.sortSelect.addEventListener('change', (e) => {
    state.sortBy = e.target.value;
    renderApp();
  });

  // 5. Accordion Toggle for Completed Tasks
  elements.accordionHeader.addEventListener('click', (e) => {
    // If the click originated from the clear button, don't toggle accordion
    if (e.target.closest('#clearCompletedBtn')) return;

    state.isCompletedOpen = !state.isCompletedOpen;
    elements.accordionHeader.classList.toggle('open', state.isCompletedOpen);
    elements.completedTasksWrapper.classList.toggle('show', state.isCompletedOpen);
  });

  // 6. Clear All Completed Tasks Button
  elements.clearCompletedBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    clearAllCompleted();
  });

  // 7. Modal Edit Form
  elements.editForm.addEventListener('submit', handleEditFormSubmit);
  elements.closeModalBtn.addEventListener('click', closeEditModal);
  elements.cancelModalBtn.addEventListener('click', closeEditModal);

  // Close modal when clicking on backdrop
  elements.editModal.addEventListener('click', (e) => {
    if (e.target === elements.editModal) {
      closeEditModal();
    }
  });

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && elements.editModal.classList.contains('open')) {
      closeEditModal();
    }
  });
}

// Initialization
function init() {
  // Set current date banner
  elements.currentDateText.textContent = formatKoreanDate(new Date());

  setupTheme();
  loadTasks();
  setupEventListeners();
  renderApp();
}

document.addEventListener('DOMContentLoaded', init);


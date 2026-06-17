import {
  COLOR_PALETTE,
  DEFAULT_TASKS,
  EFFECTIVE_START_DATE,
  INVITE_CODE,
  LEGACY_USERNAME,
  activeTasks,
  addDays,
  addMonths,
  completionCount,
  completionRate,
  createDefaultTasks,
  dateLabel,
  dotMonth,
  fromDateKey,
  hiddenTasks,
  isCompleted,
  isEditable,
  isTaskActiveOn,
  monthGrid,
  monthLabel,
  normalizeTask,
  normalizeUsername,
  overviewStats,
  recordKey,
  sortTasks,
  startOfMonth,
  taskStats,
  todayKey,
  validateUsername,
  visibleTasks,
  weekKeys
} from "./domain.js";
import {
  cloudEnabled,
  fetchRecords,
  fetchTasks,
  fetchUsers,
  initializeCloud,
  saveRecord,
  saveTasksRemote,
  saveUser
} from "./api.js";
import {
  currentUsername,
  ensureLegacyUser,
  isLoggedIn,
  loadCache,
  loadTasks,
  loadUsers,
  logout,
  saveCache,
  saveTasks,
  saveUsers,
  setLoggedIn
} from "./storage.js";

const app = document.querySelector("#app");
const state = {
  route: isLoggedIn() ? "home" : "login",
  username: currentUsername(),
  users: [],
  tasks: [],
  selectedDate: todayKey(),
  month: startOfMonth(todayKey()),
  records: new Map(),
  loading: isLoggedIn(),
  saving: new Set(),
  message: "",
  offline: !navigator.onLine,
  cloudStatus: cloudEnabled() ? "syncing" : "local",
  taskMonths: {},
  editingTaskId: "",
  hiddenExpanded: false,
  formError: ""
};

function currentTasks(date = state.selectedDate) {
  return activeTasks(state.tasks, date);
}

function currentVisibleTasks() {
  return visibleTasks(state.tasks);
}

function currentHiddenTasks() {
  return hiddenTasks(state.tasks);
}

function recordArray() {
  return [...state.records.values()];
}

function currentUserRecords() {
  return recordArray().filter((item) => (item.username ?? state.username) === state.username);
}

function loadRecordArray(records) {
  state.records = new Map(
    records.map((item) => {
      const username = item.username ?? state.username ?? LEGACY_USERNAME;
      const taskId = item.task_id ?? item.taskId;
      return [
        recordKey(taskId, item.date, username),
        {
          username,
          taskId,
          date: item.date,
          completed: item.completed,
          updatedAt: item.updated_at ?? item.updatedAt
        }
      ];
    })
  );
}

function icon(name) {
  if (name === "home") return `<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-7H9v7H3z"/></svg>`;
  if (name === "records") return `<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
  if (name === "edit") return `<svg viewBox="0 0 24 24"><path d="M5 19l4-.8L19 8.2 15.8 5 5.8 15z"/><path d="M14.5 6.5l3 3"/></svg>`;
  if (name === "hide") return `<svg viewBox="0 0 24 24"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><path d="M4 20 20 4"/></svg>`;
  if (name === "show") return `<svg viewBox="0 0 24 24"><path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="3"/></svg>`;
  if (name === "drag") return `<svg viewBox="0 0 24 24"><circle cx="8" cy="6" r="1.5"/><circle cx="16" cy="6" r="1.5"/><circle cx="8" cy="12" r="1.5"/><circle cx="16" cy="12" r="1.5"/><circle cx="8" cy="18" r="1.5"/><circle cx="16" cy="18" r="1.5"/></svg>`;
  return `<svg viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="18" rx="5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
}

function chevron(direction) {
  const paths = {
    left: "m15 5-7 7 7 7",
    right: "m9 5 7 7-7 7",
    down: "m5 9 7 7 7-7",
    up: "m5 15 7-7 7 7"
  };
  return `<svg viewBox="0 0 24 24"><path d="${paths[direction] ?? paths.right}"/></svg>`;
}

function bottomNav(active) {
  return `
    <nav class="bottom-nav" aria-label="主导航">
      <button data-route="home" class="${active === "home" ? "active" : ""}">
        ${icon("home")}<span>首页</span>
      </button>
      <button data-route="month" class="${active === "records" ? "active" : ""}">
        ${icon("records")}<span>记录</span>
      </button>
    </nav>`;
}

function statusLine() {
  if (state.offline) return `<div class="network-status">离线，只能查看</div>`;
  if (state.cloudStatus === "synced") {
    return `<div class="sync-status"><i></i><span>已同步</span></div>`;
  }
  if (state.cloudStatus === "syncing") {
    return `<div class="sync-status local"><i></i><span>同步中</span></div>`;
  }
  return `<div class="sync-status local"><i></i><span>本机模式</span></div>`;
}

function userSwitch() {
  return `<button class="user-switch" data-logout><span>${state.username}</span><strong>切换</strong></button>`;
}

function gridSquares(date, size = "week") {
  const tasks = currentTasks(date).slice(0, size === "month" ? 9 : 4);
  const squares = tasks.map((task) => {
    const completed = isCompleted(state.records, task.id, date, state.username);
    return `<i style="--task-color:${completed ? task.color : "var(--gray)"}"></i>`;
  }).join("");
  const target = size === "month" ? 9 : 4;
  const missing = Array.from({ length: Math.max(0, target - tasks.length) }, () => "<i></i>").join("");
  return `<span class="${size === "month" ? "nine-grid" : "week-grid"}">${squares}${missing}</span>`;
}

function renderLogin() {
  app.innerHTML = `
    <main class="screen login-screen">
      <section class="login-content">
        <h1>万岁</h1>
        <p>把今天做过的事，好好记下来。</p>
        <form id="login-form">
          <label><span>用户名</span><input name="username" autocomplete="username" placeholder="请输入用户名"></label>
        <p class="field-error" aria-live="polite">${state.formError}</p>
        <button class="primary-button">进入万岁 <b>›</b></button>
        </form>
        <button class="text-link register-link" data-route="register"><span>还没有用户名？</span><strong>去注册</strong></button>
        <aside class="login-note compact">
          <strong>＋</strong>
          <div><b>V1.1 · 多用户版本</b><span>输入已注册用户名即可进入</span><span>未注册会跳转到注册页</span></div>
        </aside>
      </section>
    </main>`;
}

function renderRegister() {
  app.innerHTML = `
    <main class="screen login-screen">
      <section class="login-content register-content">
        <header class="auth-title-row">
          <button class="back-button" data-route="login">${chevron("left")}</button>
          <h1>注册用户名</h1>
        </header>
        <p>邀请码正确后，就可以拥有自己的万岁。</p>
        <form id="register-form">
          <label><span>用户名</span><input name="username" autocomplete="username" placeholder="2-16 个字符"></label>
          <label><span>邀请码</span><input name="invite" autocomplete="off" placeholder="请输入邀请码"></label>
          <p class="field-error" aria-live="polite">${state.formError}</p>
          <button class="primary-button">注册并进入</button>
        </form>
        <button class="text-link register-bottom-link" data-route="login"><span>已经有用户名？</span><strong>返回登录</strong></button>
      </section>
    </main>`;
}

function renderHome() {
  const today = todayKey();
  const tasks = currentTasks(state.selectedDate);
  const completed = completionCount(state.records, state.selectedDate, state.tasks, state.username);
  const days = weekKeys(state.selectedDate);
  app.innerHTML = `
    <main class="screen app-screen">
      <header class="brand-row"><h1>万岁</h1><div class="brand-actions">${statusLine()}${userSwitch()}</div></header>
      <section class="date-nav">
        <button data-date-step="-1" ${state.selectedDate <= EFFECTIVE_START_DATE ? "disabled" : ""}>${chevron("left")}</button>
        <strong>${dateLabel(state.selectedDate)}</strong>
        <button data-date-step="1" ${state.selectedDate >= today ? "disabled" : ""}>${chevron("right")}</button>
      </section>
      <section class="week-overview">
        ${days.map((date) => {
          const classes = [
            date === state.selectedDate ? "selected" : "",
            date === today && date !== state.selectedDate ? "today" : "",
            date > today ? "future" : ""
          ].filter(Boolean).join(" ");
          return `<div class="week-day ${classes}">${gridSquares(date)}</div>`;
        }).join("")}
      </section>
      <section class="tasks">
        <h2>我做了…</h2>
        <p>选中的这一天，完成了 ${completed} / ${tasks.length}</p>
        <div class="task-list">
          ${tasks.map((task) => {
            const done = isCompleted(state.records, task.id, state.selectedDate, state.username);
            const key = recordKey(task.id, state.selectedDate, state.username);
            const saving = state.saving.has(key);
            return `
              <button class="task-card ${done ? "done" : ""}" style="--task-color:${task.color}" data-task="${task.id}" ${saving || !isEditable(state.selectedDate) ? "disabled" : ""}>
                <i class="task-color"></i><strong>${task.name}</strong>
                <span class="check">${saving ? '<i class="spinner"></i>' : done ? "✓" : ""}</span>
              </button>`;
          }).join("")}
        </div>
        <button class="edit-entry" data-route="edit">编辑打卡事件</button>
      </section>
      ${bottomNav("home")}
      ${state.message ? `<div class="toast">${state.message}</div>` : ""}
    </main>`;
}

function recordsTabs(active) {
  return `<header class="record-tabs">
    <button data-route="month" class="${active === "month" ? "active" : ""}">月历</button>
    <button data-route="tasks" class="${active === "tasks" ? "active" : ""}">任务</button>
  </header>`;
}

function renderMonth() {
  const today = todayKey();
  const currentMonth = startOfMonth(today);
  const cells = monthGrid(state.month);
  app.innerHTML = `
    <main class="screen app-screen">
      ${recordsTabs("month")}
      <section class="month-nav">
        <button data-month-step="-1">${chevron("left")}</button>
        <strong>${monthLabel(state.month)}</strong>
        <button data-month-step="1" ${state.month >= currentMonth ? "disabled" : ""}>${chevron("right")}</button>
      </section>
      <section class="calendar">
        <header>${["日","一","二","三","四","五","六"].map((day) => `<span>${day}</span>`).join("")}</header>
        <div class="calendar-grid">
          ${cells.map((cell) => {
            const future = cell.key > today;
            const highlighted = cell.inMonth && !future && completionRate(state.records, cell.key, state.tasks, state.username) >= 0.5;
            const classes = [
              cell.inMonth ? "" : "outside",
              future ? "future" : "",
              cell.key === today ? "today" : "",
              highlighted ? "highlighted" : ""
            ].filter(Boolean).join(" ");
            return `<div class="calendar-day ${classes}"><span>${cell.day}</span>${gridSquares(cell.key, "month")}</div>`;
          }).join("")}
        </div>
      </section>
      ${bottomNav("records")}
    </main>`;
}

function renderDotCalendar(task, monthKey) {
  const today = todayKey();
  return `<div class="dot-month">
    <strong>${monthLabel(monthKey, false)}</strong>
    <div class="dot-grid">
      ${dotMonth(monthKey).map((cell) => {
        const color = cell.hidden || !isTaskActiveOn(task, cell.key)
          ? "outside"
          : isCompleted(state.records, task.id, cell.key, state.username) ? "done" : "empty";
        return `<i class="${color} ${cell.key === today ? "today" : ""}" style="--task-color:${task.color}"></i>`;
      }).join("")}
    </div>
  </div>`;
}

function taskRecordArticle(task, muted = false) {
  const latest = state.taskMonths[task.id] ?? startOfMonth(todayKey());
  const months = [addMonths(latest, -2), addMonths(latest, -1), latest];
  const stats = taskStats(state.records, task.id, latest, todayKey(), state.tasks, state.username);
  return `<article class="task-record ${muted ? "hidden-record" : ""}">
    <header><i style="background:${task.color}"></i><h2>${task.name}</h2><span>${muted ? "已隐藏" : fromDateKey(latest).getFullYear()}</span></header>
    <div class="month-window">
      <button data-task-month="${task.id}" data-step="-1" aria-label="查看更早月份">${chevron("left")}</button>
      <div class="dot-months">${months.map((month) => renderDotCalendar(task, month)).join("")}</div>
      <button data-task-month="${task.id}" data-step="1" ${latest >= startOfMonth(todayKey()) ? "disabled" : ""} aria-label="查看更新月份">${chevron("right")}</button>
    </div>
    <div class="metrics">
      <span><small>本月打卡率</small><strong>${stats.monthRate}%</strong></span>
      <span><small>本月次数</small><strong>${stats.monthCount}</strong></span>
      <span><small>当前连续</small><strong>${stats.currentStreak}天</strong></span>
      <span><small>最长连续</small><strong>${stats.longestStreak}天</strong></span>
    </div>
  </article>`;
}

function renderTasks() {
  const summary = overviewStats(state.records, state.month, todayKey(), state.tasks, state.username);
  const visible = currentVisibleTasks();
  const hidden = currentHiddenTasks();
  app.innerHTML = `
    <main class="screen app-screen task-record-screen">
      ${recordsTabs("tasks")}
      <section class="overview">
        <h2>本月总览</h2>
        <div>
          <span><small>绿灯天数</small><strong>${summary.greenDays}</strong></span>
          <span><small>总完成率</small><strong>${summary.totalRate}%</strong></span>
          <span><small>总打卡</small><strong>${summary.totalCheckins}</strong></span>
        </div>
      </section>
      <section class="task-records">
        ${visible.map((task) => taskRecordArticle(task)).join("")}
        ${hidden.length ? `<button class="hidden-title task-hidden-title" data-toggle-hidden>${icon("hide")}<strong>已隐藏任务 ${hidden.length}</strong><span>${chevron(state.hiddenExpanded ? "up" : "down")}</span></button>` : ""}
        ${state.hiddenExpanded ? hidden.map((task) => taskRecordArticle(task, true)).join("") : ""}
      </section>
      ${bottomNav("records")}
    </main>`;
}

function renderEdit() {
  const visible = currentVisibleTasks();
  const hidden = currentHiddenTasks();
  const canAdd = visible.length < 9;
  app.innerHTML = `
    <main class="screen app-screen edit-screen">
      <header class="edit-header">
        <button data-route="home">${chevron("left")}</button>
        <h1>编辑打卡事件</h1>
      </header>
      <p class="edit-tip">拖动排序，编辑名称和颜色，隐藏不删除历史。</p>
      <section class="edit-list">
        ${visible.map((task) => `<div class="edit-row" style="--task-color:${task.color}" data-edit-row="${task.id}">
          <button data-drag-handle="${task.id}" class="icon-button drag" aria-label="拖动排序">${icon("drag")}</button>
          <i></i><strong>${task.name}</strong>
          <button data-edit-task="${task.id}" class="icon-button">${icon("edit")}</button>
          <button data-hide-task="${task.id}" class="icon-button">${icon("hide")}</button>
        </div>`).join("")}
      </section>
      <button class="add-task-button" data-route="new-task" ${canAdd ? "" : "disabled"}>＋ 新增打卡事件</button>
      ${!canAdd ? `<p class="edit-warning">最多只能同时显示 9 个打卡事件</p>` : ""}
      ${hidden.length ? `<section class="hidden-edit">
        <button class="hidden-title" data-toggle-hidden>${icon("hide")}<strong>已隐藏任务 ${hidden.length}</strong><span>${chevron(state.hiddenExpanded ? "up" : "down")}</span></button>
        ${state.hiddenExpanded ? hidden.map((task) => `<div class="edit-row hidden-row" style="--task-color:${task.color}">
          <i></i><strong>${task.name}</strong>
          <button data-restore-task="${task.id}" class="icon-button">${icon("show")}</button>
        </div>`).join("") : ""}
      </section>` : ""}
      ${state.message ? `<div class="toast">${state.message}</div>` : ""}
    </main>`;
}

function renderTaskForm(mode) {
  const task = state.tasks.find((item) => item.id === state.editingTaskId);
  const editing = mode === "edit-task" && task;
  const title = editing ? "编辑打卡事件" : "新增打卡事件";
  const name = editing ? task.name : "";
  const color = editing ? task.color : COLOR_PALETTE[6];
  app.innerHTML = `
    <main class="screen app-screen edit-screen">
      <header class="edit-header">
        <button data-route="edit">${chevron("left")}</button>
        <h1>${title}</h1>
      </header>
      <form id="task-form" class="task-form">
        <label><span>名称</span><input name="name" maxlength="12" value="${escapeHtml(name)}" placeholder="例如：喝水"></label>
        <input type="hidden" name="color" value="${color}">
        <section class="palette" aria-label="选择颜色">
          ${COLOR_PALETTE.map((item) => `<button type="button" class="${item === color ? "selected" : ""}" data-color="${item}" style="--task-color:${item}"></button>`).join("")}
        </section>
        <p class="field-error" aria-live="polite">${state.formError}</p>
        <button class="primary-button">${editing ? "保存修改" : "新增打卡事件"}</button>
      </form>
    </main>`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;"
  })[char]);
}

function render() {
  if (state.loading && state.route !== "login" && state.route !== "register") {
    app.innerHTML = `<main class="screen loading-screen"><i class="spinner"></i></main>`;
    return;
  }
  if (state.route === "login") renderLogin();
  else if (state.route === "register") renderRegister();
  else if (state.route === "home") renderHome();
  else if (state.route === "tasks") renderTasks();
  else if (state.route === "edit") renderEdit();
  else if (state.route === "new-task" || state.route === "edit-task") renderTaskForm(state.route);
  else renderMonth();
  bindEvents();
}

function mergeUsers(localUsers, remoteUsers) {
  const merged = new Map();
  [...localUsers, ...remoteUsers].forEach((user) => {
    if (!user?.username) return;
    merged.set(user.username, {
      username: user.username,
      createdAt: user.createdAt ?? new Date().toISOString()
    });
  });
  return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

async function refreshUsersFromCloud() {
  if (!cloudEnabled() || !navigator.onLine) return loadUsers();
  const remoteUsers = await fetchUsers();
  const localUsers = await loadUsers();
  const merged = mergeUsers(localUsers, remoteUsers);
  await saveUsers(merged);
  state.users = merged;
  return merged;
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      state.formError = "";
      state.route = button.dataset.route;
      if (state.route === "tasks") state.hiddenExpanded = false;
      render();
    });
  });

  document.querySelector("[data-logout]")?.addEventListener("click", () => {
    logout();
    state.username = "";
    state.tasks = [];
    state.records = new Map();
    state.route = "login";
    state.formError = "";
    state.loading = false;
    render();
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = normalizeUsername(new FormData(event.currentTarget).get("username"));
    const error = validateUsername(username);
    if (error) {
      state.formError = error;
      render();
      return;
    }
    let users = await loadUsers();
    if (!users.some((user) => user.username === username) && cloudEnabled() && navigator.onLine) {
      try {
        users = await refreshUsersFromCloud();
      } catch {}
    }
    if (!users.some((user) => user.username === username)) {
      state.route = "register";
      state.formError = "这个用户名还没有注册";
      render();
      return;
    }
    await login(username);
  });

  document.querySelector("#register-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = normalizeUsername(form.get("username"));
    const invite = String(form.get("invite") ?? "").trim();
    const error = validateUsername(username);
    if (error) {
      state.formError = error;
      render();
      return;
    }
    const users = await loadUsers();
    if (users.some((user) => user.username === username)) {
      state.formError = "这个用户名已经注册，可以直接登录";
      render();
      return;
    }
    if (invite !== INVITE_CODE) {
      state.formError = "邀请码不正确";
      render();
      return;
    }
    const createdAt = new Date().toISOString();
    users.push({ username, createdAt });
    await saveUsers(users);
    const defaultTasks = createDefaultTasks(todayKey());
    await saveTasks(username, defaultTasks);
    if (cloudEnabled() && navigator.onLine) {
      try {
        await saveUser(username, createdAt);
        await saveTasksRemote(username, defaultTasks);
        state.cloudStatus = "synced";
      } catch {
        state.cloudStatus = "local";
      }
    }
    await login(username);
  });

  document.querySelectorAll("[data-date-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedDate = addDays(state.selectedDate, Number(button.dataset.dateStep));
      render();
    });
  });

  document.querySelectorAll("[data-month-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.month = addMonths(state.month, Number(button.dataset.monthStep));
      render();
    });
  });

  document.querySelectorAll("[data-task]").forEach((button) => {
    button.addEventListener("click", () => toggleTask(button.dataset.task));
  });

  document.querySelectorAll("[data-task-month]").forEach((button) => {
    button.addEventListener("click", () => {
      const taskId = button.dataset.taskMonth;
      state.taskMonths[taskId] = addMonths(state.taskMonths[taskId], Number(button.dataset.step));
      render();
    });
  });

  document.querySelector("[data-toggle-hidden]")?.addEventListener("click", () => {
    state.hiddenExpanded = !state.hiddenExpanded;
    render();
  });

  document.querySelectorAll("[data-edit-task]").forEach((button) => {
    button.addEventListener("click", () => {
      state.editingTaskId = button.dataset.editTask;
      state.route = "edit-task";
      render();
    });
  });

  document.querySelectorAll("[data-hide-task]").forEach((button) => {
    button.addEventListener("click", () => hideTask(button.dataset.hideTask));
  });

  document.querySelectorAll("[data-restore-task]").forEach((button) => {
    button.addEventListener("click", () => restoreTask(button.dataset.restoreTask));
  });

  bindDragSorting();

  document.querySelectorAll("[data-color]").forEach((button) => {
    button.addEventListener("click", () => {
      document.querySelector("input[name=color]").value = button.dataset.color;
      document.querySelectorAll("[data-color]").forEach((item) => item.classList.toggle("selected", item === button));
    });
  });

  document.querySelector("#task-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTaskForm(new FormData(event.currentTarget));
  });
}

async function login(username) {
  setLoggedIn(username);
  state.username = username;
  state.route = "home";
  state.loading = true;
  state.formError = "";
  render();
  await syncFromCloud();
}

async function ensureUserState() {
  await ensureLegacyUser();
  state.users = await loadUsers();
  if (!state.username && isLoggedIn()) state.username = currentUsername();
  if (!state.username) return;
  state.tasks = await loadTasks(state.username);
  if (!state.tasks.length) {
    state.tasks = createDefaultTasks(state.username === LEGACY_USERNAME ? EFFECTIVE_START_DATE : todayKey());
    await saveTasks(state.username, state.tasks);
  }
  for (const task of state.tasks) {
    if (!state.taskMonths[task.id]) state.taskMonths[task.id] = startOfMonth(todayKey());
  }
}

async function toggleTask(taskId) {
  if (!navigator.onLine && cloudEnabled()) {
    showMessage("网络不可用，暂时不能打卡");
    return;
  }
  const key = recordKey(taskId, state.selectedDate, state.username);
  if (state.saving.has(key)) return;
  state.saving.add(key);
  render();
  const next = !isCompleted(state.records, taskId, state.selectedDate, state.username);
  try {
    const saved = await saveRecord(taskId, state.selectedDate, next, state.username);
    state.records.set(key, {
      username: state.username,
      taskId,
      date: state.selectedDate,
      completed: saved.completed,
      updatedAt: saved.updated_at
    });
    await saveCache(state.username, currentUserRecords());
    state.cloudStatus = cloudEnabled() && navigator.onLine ? "synced" : "local";
  } catch {
    state.records.set(key, {
      username: state.username,
      taskId,
      date: state.selectedDate,
      completed: next,
      updatedAt: new Date().toISOString()
    });
    await saveCache(state.username, currentUserRecords());
    state.cloudStatus = "local";
    showMessage("已存本机，待同步");
  } finally {
    state.saving.delete(key);
    render();
  }
}

async function persistTasks() {
  state.tasks = sortTasks(state.tasks).map((task, index) => ({ ...task, sortOrder: index + 1, updatedAt: new Date().toISOString() }));
  await saveTasks(state.username, state.tasks);
  if (cloudEnabled() && navigator.onLine) {
    try {
      const saved = await saveTasksRemote(state.username, state.tasks);
      if (saved.length) {
        state.tasks = saved.map((task, index) => normalizeTask(task, index));
        for (const task of state.tasks) {
          if (!state.taskMonths[task.id]) state.taskMonths[task.id] = startOfMonth(todayKey());
        }
      }
      state.cloudStatus = "synced";
    } catch {
      state.cloudStatus = "local";
      showMessage("已存本机，待同步");
    }
  }
}

async function moveTask(taskId, direction) {
  const visible = currentVisibleTasks();
  const index = visible.findIndex((task) => task.id === taskId);
  const targetIndex = index + direction;
  if (index < 0 || targetIndex < 0 || targetIndex >= visible.length) return;
  const ordered = [...visible];
  const [task] = ordered.splice(index, 1);
  ordered.splice(targetIndex, 0, task);
  const hidden = currentHiddenTasks();
  const nextOrder = [...ordered, ...hidden].map((item, idx) => item.id);
  state.tasks = state.tasks.map((taskItem) => ({ ...taskItem, sortOrder: nextOrder.indexOf(taskItem.id) + 1 }));
  await persistTasks();
  render();
}

function bindDragSorting() {
  const list = document.querySelector(".edit-list");
  if (!list) return;
  let draggingId = "";
  let pointerId = null;

  document.querySelectorAll("[data-drag-handle]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      draggingId = handle.dataset.dragHandle;
      pointerId = event.pointerId;
      handle.setPointerCapture?.(pointerId);
      list.classList.add("sorting");
      rowById(draggingId)?.classList.add("dragging");
      event.preventDefault();
    });

    handle.addEventListener("pointermove", (event) => {
      if (!draggingId || event.pointerId !== pointerId) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-edit-row]");
      if (!target || target.dataset.editRow === draggingId) return;
      const draggingRow = rowById(draggingId);
      if (!draggingRow) return;
      const rect = target.getBoundingClientRect();
      const insertAfter = event.clientY > rect.top + rect.height / 2;
      list.insertBefore(draggingRow, insertAfter ? target.nextSibling : target);
      syncTaskOrderFromRows();
    });

    handle.addEventListener("pointerup", async (event) => {
      if (!draggingId || event.pointerId !== pointerId) return;
      draggingId = "";
      pointerId = null;
      await persistTasks();
      render();
    });

    handle.addEventListener("pointercancel", () => {
      draggingId = "";
      pointerId = null;
      render();
    });
  });
}

function rowById(taskId) {
  return [...document.querySelectorAll("[data-edit-row]")].find((row) => row.dataset.editRow === taskId);
}

function syncTaskOrderFromRows() {
  const orderedIds = [...document.querySelectorAll(".edit-list [data-edit-row]")].map((row) => row.dataset.editRow);
  const visible = orderedIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean);
  const hidden = currentHiddenTasks();
  const nextOrder = [...visible, ...hidden].map((item, index) => [item.id, index + 1]);
  const orderMap = new Map(nextOrder);
  state.tasks = state.tasks.map((taskItem) => ({ ...taskItem, sortOrder: orderMap.get(taskItem.id) ?? taskItem.sortOrder }));
}

async function hideTask(taskId) {
  const today = todayKey();
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    if ((task.hiddenPeriods ?? []).some((period) => !period.end)) return task;
    return { ...task, hiddenPeriods: [...(task.hiddenPeriods ?? []), { start: today, end: null }] };
  });
  await persistTasks();
  render();
}

async function restoreTask(taskId) {
  const today = todayKey();
  state.tasks = state.tasks.map((task) => {
    if (task.id !== taskId) return task;
    return {
      ...task,
      hiddenPeriods: (task.hiddenPeriods ?? []).map((period) => period.end ? period : { ...period, end: today })
    };
  });
  await persistTasks();
  state.hiddenExpanded = false;
  render();
}

async function saveTaskForm(form) {
  const name = String(form.get("name") ?? "").trim();
  const color = String(form.get("color") ?? COLOR_PALETTE[0]).trim();
  if (!name) {
    state.formError = "请输入打卡事件名称";
    render();
    return;
  }
  if (!COLOR_PALETTE.includes(color)) {
    state.formError = "请选择一个颜色";
    render();
    return;
  }
  if (state.route === "edit-task") {
    state.tasks = state.tasks.map((task) => task.id === state.editingTaskId ? { ...task, name, color } : task);
  } else {
    if (currentVisibleTasks().length >= 9) {
      state.formError = "最多只能同时显示 9 个打卡事件";
      render();
      return;
    }
    state.tasks.push({
      id: `task_${Date.now().toString(36)}`,
      name,
      color,
      sortOrder: currentVisibleTasks().length + 1,
      createdDate: todayKey(),
      hiddenPeriods: [],
      updatedAt: new Date().toISOString()
    });
  }
  await persistTasks();
  state.formError = "";
  state.route = "edit";
  render();
}

function showMessage(message) {
  state.message = message;
  render();
  window.setTimeout(() => {
    state.message = "";
    render();
  }, 2200);
}

async function syncFromCloud() {
  await ensureUserState();
  const cached = await loadCache(state.username);
  if (cached.length) loadRecordArray(cached);
  state.loading = false;
  state.cloudStatus = cloudEnabled() ? "syncing" : "local";
  render();
  if (!navigator.onLine || !cloudEnabled()) {
    state.cloudStatus = "local";
    render();
    return;
  }
  try {
    await initializeCloud();
    try {
      await refreshUsersFromCloud();
    } catch (error) {
      if (state.username !== LEGACY_USERNAME) throw error;
    }
    const localUsers = state.users.length ? state.users : await loadUsers();
    if (!localUsers.some((user) => user.username === state.username)) {
      const createdAt = new Date().toISOString();
      const savedUser = await saveUser(state.username, createdAt);
      const merged = mergeUsers(localUsers, [savedUser]);
      await saveUsers(merged);
      state.users = merged;
    }
    let remoteTasks = [];
    try {
      remoteTasks = await fetchTasks(state.username);
    } catch (error) {
      if (state.username !== LEGACY_USERNAME) throw error;
    }
    if (remoteTasks.length) {
      state.tasks = remoteTasks.map((task, index) => normalizeTask(task, index));
      await saveTasks(state.username, state.tasks);
    } else if (state.tasks.length) {
      try {
        const savedTasks = await saveTasksRemote(state.username, state.tasks);
        if (savedTasks.length) state.tasks = savedTasks.map((task, index) => normalizeTask(task, index));
      } catch (error) {
        if (state.username !== LEGACY_USERNAME) throw error;
      }
    }
    for (const task of state.tasks) {
      if (!state.taskMonths[task.id]) state.taskMonths[task.id] = startOfMonth(todayKey());
    }
    for (const item of currentUserRecords()) {
      await saveRecord(item.taskId, item.date, item.completed, state.username);
    }
    const cloud = await fetchRecords(state.username);
    if (cloud) {
      loadRecordArray(cloud);
      await saveCache(state.username, currentUserRecords());
      render();
    }
    state.cloudStatus = "synced";
    render();
  } catch (error) {
    state.cloudStatus = "local";
    showMessage(`${error.message || "云端连接失败"}，正在显示缓存`);
  }
}

window.addEventListener("online", () => { state.offline = false; syncFromCloud(); });
window.addEventListener("offline", () => { state.offline = true; render(); });
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state.selectedDate > todayKey()) {
    state.selectedDate = todayKey();
    render();
  }
});

if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js");

render();
if (state.route !== "login" && state.route !== "register") syncFromCloud();

import {
  EFFECTIVE_START_DATE,
  TASKS,
  addDays,
  addMonths,
  completionCount,
  completionRate,
  dateLabel,
  dotMonth,
  fromDateKey,
  isCompleted,
  isEditable,
  monthGrid,
  monthLabel,
  overviewStats,
  recordKey,
  startOfMonth,
  taskStats,
  todayKey,
  weekKeys
} from "./domain.js";
import { cloudEnabled, fetchRecords, initializeCloud, saveRecord } from "./api.js";
import { isLoggedIn, loadCache, saveCache, setLoggedIn } from "./storage.js";

const app = document.querySelector("#app");
const state = {
  route: isLoggedIn() ? "home" : "login",
  selectedDate: todayKey(),
  month: startOfMonth(todayKey()),
  records: new Map(),
  loading: true,
  saving: new Set(),
  message: "",
  offline: !navigator.onLine,
  taskMonths: Object.fromEntries(TASKS.map((task) => [task.id, startOfMonth(todayKey())]))
};

function recordArray() {
  return [...state.records.values()];
}

function loadRecordArray(records) {
  state.records = new Map(
    records.map((item) => [
      recordKey(item.task_id ?? item.taskId, item.date),
      {
        taskId: item.task_id ?? item.taskId,
        date: item.date,
        completed: item.completed,
        updatedAt: item.updated_at ?? item.updatedAt
      }
    ])
  );
}

function icon(name) {
  if (name === "home") return `<svg viewBox="0 0 24 24"><path d="M3 11 12 3l9 8v10h-6v-7H9v7H3z"/></svg>`;
  return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>`;
}

function chevron(direction) {
  return `<svg viewBox="0 0 24 24"><path d="${direction === "left" ? "m15 5-7 7 7 7" : "m9 5 7 7-7 7"}"/></svg>`;
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
  return `<div class="sync-status"><i></i><span>${cloudEnabled() ? "已同步" : "本机模式"}</span></div>`;
}

function gridSquares(date, size = "week") {
  const squares = TASKS.map((task) => {
    const completed = isCompleted(state.records, task.id, date);
    return `<i style="--task-color:${completed ? task.color : "var(--gray)"}"></i>`;
  }).join("");
  if (size === "month") {
    return `<span class="nine-grid">${squares}${Array.from({ length: 5 }, () => "<i></i>").join("")}</span>`;
  }
  return `<span class="week-grid">${squares}</span>`;
}

function renderLogin() {
  app.innerHTML = `
    <main class="screen login-screen">
      <section class="login-content">
        <h1>万岁</h1>
        <p>把今天做过的事，好好记下来。</p>
        <form id="login-form">
          <label><span>用户名</span><input name="username" autocomplete="username" placeholder="请输入用户名"></label>
          <p class="field-error" aria-live="polite"></p>
          <button class="primary-button">进入万岁 <b>›</b></button>
        </form>
        <aside class="login-note">
          <strong>＋</strong>
          <div><b>只属于你的 V1</b><span>手机会记住登录状态</span><span>换设备后重新输入用户名即可</span></div>
        </aside>
      </section>
    </main>`;
}

function renderHome() {
  const today = todayKey();
  const completed = completionCount(state.records, state.selectedDate);
  const days = weekKeys(state.selectedDate);
  app.innerHTML = `
    <main class="screen app-screen">
      <header class="brand-row"><h1>万岁</h1>${statusLine()}</header>
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
        <p>选中的这一天，完成了 ${completed} / ${TASKS.length}</p>
        <div class="task-list">
          ${TASKS.map((task) => {
            const done = isCompleted(state.records, task.id, state.selectedDate);
            const key = recordKey(task.id, state.selectedDate);
            const saving = state.saving.has(key);
            return `
              <button class="task-card ${done ? "done" : ""}" style="--task-color:${task.color}" data-task="${task.id}" ${saving || !isEditable(state.selectedDate) ? "disabled" : ""}>
                <i class="task-color"></i><strong>${task.name}</strong>
                <span class="check">${saving ? '<i class="spinner"></i>' : done ? "✓" : ""}</span>
              </button>`;
          }).join("")}
        </div>
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
            const highlighted = cell.inMonth && !future && completionRate(state.records, cell.key) >= 0.5;
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
        const color = cell.hidden
          ? "outside"
          : isCompleted(state.records, task.id, cell.key) ? "done" : "empty";
        return `<i class="${color} ${cell.key === today ? "today" : ""}" style="--task-color:${task.color}"></i>`;
      }).join("")}
    </div>
  </div>`;
}

function renderTasks() {
  const summary = overviewStats(state.records);
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
        ${TASKS.map((task) => {
          const latest = state.taskMonths[task.id];
          const months = [addMonths(latest, -2), addMonths(latest, -1), latest];
          const stats = taskStats(state.records, task.id);
          return `<article class="task-record">
            <header><i style="background:${task.color}"></i><h2>${task.name}</h2><span>${fromDateKey(latest).getFullYear()}</span></header>
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
        }).join("")}
      </section>
      ${bottomNav("records")}
    </main>`;
}

function render() {
  if (state.loading && state.route !== "login") {
    app.innerHTML = `<main class="screen loading-screen"><i class="spinner"></i></main>`;
    return;
  }
  if (state.route === "login") renderLogin();
  else if (state.route === "home") renderHome();
  else if (state.route === "tasks") renderTasks();
  else renderMonth();
  bindEvents();
}

function bindEvents() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      state.route = button.dataset.route;
      render();
    });
  });

  document.querySelector("#login-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const input = new FormData(event.currentTarget).get("username")?.trim();
    if (input !== "ysw") {
      document.querySelector(".field-error").textContent = "用户名不正确";
      return;
    }
    setLoggedIn();
    state.route = "home";
    state.loading = true;
    render();
    await syncFromCloud();
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
}

async function toggleTask(taskId) {
  if (!navigator.onLine && cloudEnabled()) {
    showMessage("网络不可用，暂时不能打卡");
    return;
  }
  const key = recordKey(taskId, state.selectedDate);
  if (state.saving.has(key)) return;
  state.saving.add(key);
  render();
  const next = !isCompleted(state.records, taskId, state.selectedDate);
  try {
    const saved = await saveRecord(taskId, state.selectedDate, next);
    state.records.set(key, {
      taskId,
      date: state.selectedDate,
      completed: saved.completed,
      updatedAt: saved.updated_at
    });
    await saveCache(recordArray());
  } catch {
    showMessage("保存失败，请稍后重试");
  } finally {
    state.saving.delete(key);
    render();
  }
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
  const cached = await loadCache();
  if (cached.length) loadRecordArray(cached);
  state.loading = false;
  render();
  if (!navigator.onLine || !cloudEnabled()) return;
  try {
    await initializeCloud();
    const cloud = await fetchRecords();
    if (cloud) {
      loadRecordArray(cloud);
      await saveCache(recordArray());
      render();
    }
  } catch (error) {
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
if (state.route !== "login") syncFromCloud();

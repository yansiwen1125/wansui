export const EFFECTIVE_START_DATE = "2026-06-10";
export const INVITE_CODE = "yansiwen1125";
export const LEGACY_USERNAME = "ysw";

export const DEFAULT_TASKS = [
  { id: "preset_bowel", name: "拉屎", color: "#A9795B", sortOrder: 1 },
  { id: "preset_sleep", name: "早睡", color: "#315F8A", sortOrder: 2 },
  { id: "preset_exercise", name: "运动", color: "#82BDE3", sortOrder: 3 },
  { id: "preset_healthy_diet", name: "饮食健康", color: "#7FB77E", sortOrder: 4 }
];

export const TASKS = DEFAULT_TASKS;

export const COLOR_PALETTE = [
  "#C62828", "#EB5757", "#FF6F61", "#D33682", "#F299B7", "#B85C38", "#A9795B", "#6B4E2E",
  "#D2691E", "#E4572E", "#FF8C42", "#F3A712", "#F7D002", "#C0CA33", "#8BC34A", "#6A994E",
  "#2E7D32", "#009B72", "#00B8A9", "#7FB77E", "#00A6FB", "#82BDE3", "#2D9CDB", "#007C89",
  "#1F4E79", "#315F8A", "#2F80ED", "#4F5D75", "#3D405B", "#264653", "#5E35B1", "#7B61FF",
  "#9C27B0", "#BB6BD9", "#6D597A", "#8D6E63", "#C18C5D", "#4F4F4F", "#828282", "#333333"
];

const pad = (value) => String(value).padStart(2, "0");

export function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function fromDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function todayKey() {
  return toDateKey(new Date());
}

export function addDays(key, amount) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + amount);
  return toDateKey(date);
}

export function addMonths(key, amount) {
  const date = fromDateKey(key);
  date.setDate(1);
  date.setMonth(date.getMonth() + amount);
  return toDateKey(date);
}

export function startOfMonth(key) {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function endOfMonth(key) {
  const date = fromDateKey(key);
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

export function startOfWeek(key) {
  const date = fromDateKey(key);
  date.setDate(date.getDate() - date.getDay());
  return toDateKey(date);
}

export function weekKeys(key) {
  const start = startOfWeek(key);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGrid(key) {
  const monthStart = fromDateKey(startOfMonth(key));
  const gridStart = new Date(monthStart);
  gridStart.setDate(1 - monthStart.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateKey = toDateKey(date);
    return {
      key: dateKey,
      day: date.getDate(),
      inMonth: date.getMonth() === monthStart.getMonth()
    };
  });
}

export function dateLabel(key) {
  const date = fromDateKey(key);
  const weekday = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return `${date.getMonth() + 1}月${date.getDate()}日 · ${weekday[date.getDay()]}`;
}

export function monthLabel(key, withYear = true) {
  const date = fromDateKey(key);
  return withYear ? `${date.getFullYear()}年${date.getMonth() + 1}月` : `${date.getMonth() + 1}月`;
}

export function isEditable(key, today = todayKey()) {
  return key >= EFFECTIVE_START_DATE && key <= today;
}

export function normalizeUsername(value) {
  return String(value ?? "").trim().toLowerCase();
}

export function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!username) return "请输入用户名";
  if (username.length < 2 || username.length > 16) return "用户名需要 2 到 16 个字符";
  if (!/^[\u4e00-\u9fa5a-z0-9_]+$/.test(username)) return "只能使用中文、英文、数字和下划线";
  return "";
}

export function createDefaultTasks(date = EFFECTIVE_START_DATE) {
  return DEFAULT_TASKS.map((task) => ({
    ...task,
    createdDate: date,
    hiddenPeriods: [],
    updatedAt: new Date().toISOString()
  }));
}

export function normalizeTask(task, index = 0) {
  return {
    id: task.id,
    name: task.name,
    color: task.color,
    sortOrder: task.sortOrder ?? index + 1,
    createdDate: task.createdDate ?? task.created_date ?? EFFECTIVE_START_DATE,
    hiddenPeriods: task.hiddenPeriods ?? task.hidden_periods ?? [],
    updatedAt: task.updatedAt ?? task.updated_at ?? new Date().toISOString()
  };
}

export function normalizeTasks(tasks = []) {
  return tasks.map(normalizeTask).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function sortTasks(tasks) {
  return [...tasks].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function normalizeTaskVersion(version, index = 0) {
  return {
    effectiveDate: version.effectiveDate ?? version.effective_date ?? EFFECTIVE_START_DATE,
    tasks: normalizeTasks(version.tasks ?? []),
    updatedAt: version.updatedAt ?? version.updated_at ?? new Date().toISOString(),
    index
  };
}

export function normalizeTaskVersions(versions = []) {
  return versions
    .map(normalizeTaskVersion)
    .sort((a, b) => a.effectiveDate.localeCompare(b.effectiveDate) || a.index - b.index)
    .map(({ index, ...version }) => version);
}

export function createTaskVersion(effectiveDate, tasks) {
  return {
    effectiveDate,
    tasks: normalizeTasks(tasks),
    updatedAt: new Date().toISOString()
  };
}

export function ensureInitialTaskVersion(versions = [], tasks = [], date = EFFECTIVE_START_DATE) {
  const normalized = normalizeTaskVersions(versions);
  if (normalized.length) return normalized;
  return [createTaskVersion(date, tasks)];
}

export function taskVersionForDate(versions = [], date = todayKey(), fallbackTasks = []) {
  const normalized = ensureInitialTaskVersion(versions, fallbackTasks);
  let selected = null;
  for (const version of normalized) {
    if (version.effectiveDate <= date) selected = version;
    else break;
  }
  return selected ?? normalized[0] ?? createTaskVersion(EFFECTIVE_START_DATE, fallbackTasks);
}

export function tasksForDate(versions = [], date = todayKey(), fallbackTasks = []) {
  return normalizeTasks(taskVersionForDate(versions, date, fallbackTasks).tasks);
}

export function upsertTaskVersion(versions = [], effectiveDate = todayKey(), tasks = []) {
  const version = createTaskVersion(effectiveDate, tasks);
  const withoutToday = normalizeTaskVersions(versions).filter((item) => item.effectiveDate !== effectiveDate);
  return normalizeTaskVersions([...withoutToday, version]);
}

export function applyTaskOrder(tasks, orderedIds) {
  const existingIds = tasks.map((task) => task.id);
  const uniqueOrderedIds = [...new Set(orderedIds)].filter((id) => existingIds.includes(id));
  const remainingIds = existingIds.filter((id) => !uniqueOrderedIds.includes(id));
  const orderMap = new Map([...uniqueOrderedIds, ...remainingIds].map((id, index) => [id, index + 1]));
  return tasks.map((task) => ({ ...task, sortOrder: orderMap.get(task.id) ?? task.sortOrder }));
}

export function isTaskHiddenNow(task) {
  return (task.hiddenPeriods ?? []).some((period) => period.start && !period.end);
}

export function activeTasks(tasks, date = todayKey()) {
  return sortTasks(tasks).filter((task) => isTaskActiveOn(task, date));
}

export function hiddenTasks(tasks) {
  return sortTasks(tasks).filter(isTaskHiddenNow);
}

export function visibleTasks(tasks) {
  return sortTasks(tasks).filter((task) => !isTaskHiddenNow(task));
}

export function moveTaskToVisibleEnd(tasks, taskId) {
  const visibleIds = visibleTasks(tasks).filter((task) => task.id !== taskId).map((task) => task.id);
  const hiddenIds = hiddenTasks(tasks).filter((task) => task.id !== taskId).map((task) => task.id);
  return applyTaskOrder(tasks, [...visibleIds, taskId, ...hiddenIds]);
}

export function moveTaskToHiddenEnd(tasks, taskId) {
  const visibleIds = visibleTasks(tasks).filter((task) => task.id !== taskId).map((task) => task.id);
  const hiddenIds = hiddenTasks(tasks).filter((task) => task.id !== taskId).map((task) => task.id);
  return applyTaskOrder(tasks, [...visibleIds, ...hiddenIds, taskId]);
}

export function isTaskActiveOn(task, date) {
  if (!task || date < (task.createdDate ?? EFFECTIVE_START_DATE)) return false;
  return !(task.hiddenPeriods ?? []).some((period) => {
    if (!period.start) return false;
    const end = period.end ?? "9999-12-31";
    return date >= period.start && date < end;
  });
}

export function recordKey(taskId, date, username = "") {
  return username ? `${username}:${taskId}:${date}` : `${taskId}:${date}`;
}

export function isCompleted(records, taskId, date, username = "") {
  return records.get(recordKey(taskId, date, username))?.completed === true
    || records.get(recordKey(taskId, date))?.completed === true;
}

export function hasCompletedRecord(records, taskId, username = "") {
  return [...records.values()].some((record) => {
    if (record.taskId !== taskId && record.task_id !== taskId) return false;
    if (username && (record.username ?? username) !== username) return false;
    return record.completed === true;
  });
}

export function completionCount(records, date, tasks = DEFAULT_TASKS, username = "") {
  return activeTasks(tasks, date).filter((task) => isCompleted(records, task.id, date, username)).length;
}

export function completionRate(records, date, tasks = DEFAULT_TASKS, username = "") {
  const total = activeTasks(tasks, date).length;
  return total ? completionCount(records, date, tasks, username) / total : 0;
}

export function inclusiveDateKeys(start, end) {
  if (start > end) return [];
  const keys = [];
  for (let key = start; key <= end; key = addDays(key, 1)) keys.push(key);
  return keys;
}

function effectiveMonthRange(monthKey, today = todayKey()) {
  const start = [startOfMonth(monthKey), EFFECTIVE_START_DATE].sort().at(-1);
  const end = [endOfMonth(monthKey), today].sort().at(0);
  return inclusiveDateKeys(start, end);
}

export function overviewStats(records, monthKey = todayKey(), today = todayKey(), tasks = DEFAULT_TASKS, username = "") {
  const days = effectiveMonthRange(monthKey, today);
  let possible = 0;
  const total = days.reduce((sum, date) => {
    possible += activeTasks(tasks, date).length;
    return sum + completionCount(records, date, tasks, username);
  }, 0);
  return {
    greenDays: days.filter((date) => completionRate(records, date, tasks, username) >= 0.5).length,
    totalRate: possible ? Math.round((total / possible) * 100) : 0,
    totalCheckins: total
  };
}

export function taskStats(records, taskId, monthKey = todayKey(), today = todayKey(), tasks = DEFAULT_TASKS, username = "") {
  const task = tasks.find((item) => item.id === taskId);
  const monthDays = effectiveMonthRange(monthKey, today).filter((date) => !task || isTaskActiveOn(task, date));
  const monthCount = monthDays.filter((date) => isCompleted(records, taskId, date, username)).length;
  const currentStart = isCompleted(records, taskId, today, username) ? today : addDays(today, -1);
  let currentStreak = 0;
  if (currentStart >= EFFECTIVE_START_DATE && isCompleted(records, taskId, currentStart, username)) {
    for (let date = currentStart; date >= EFFECTIVE_START_DATE; date = addDays(date, -1)) {
      if (task && !isTaskActiveOn(task, date)) break;
      if (!isCompleted(records, taskId, date, username)) break;
      currentStreak += 1;
    }
  }
  let longestStreak = 0;
  let run = 0;
  for (const date of inclusiveDateKeys(EFFECTIVE_START_DATE, today)) {
    if (task && !isTaskActiveOn(task, date)) {
      run = 0;
    } else if (isCompleted(records, taskId, date, username)) {
      run += 1;
      longestStreak = Math.max(longestStreak, run);
    } else {
      run = 0;
    }
  }
  return {
    monthRate: monthDays.length ? Math.round((monthCount / monthDays.length) * 100) : 0,
    monthCount,
    currentStreak,
    longestStreak
  };
}

export function dotMonth(key) {
  return monthGrid(key).map((cell) => ({ ...cell, hidden: !cell.inMonth }));
}

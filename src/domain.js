export const EFFECTIVE_START_DATE = "2026-06-10";

export const TASKS = [
  { id: "preset_bowel", name: "拉屎", color: "#A9795B" },
  { id: "preset_sleep", name: "早睡", color: "#315F8A" },
  { id: "preset_exercise", name: "运动", color: "#82BDE3" },
  { id: "preset_healthy_diet", name: "饮食健康", color: "#7FB77E" }
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

export function recordKey(taskId, date) {
  return `${taskId}:${date}`;
}

export function isCompleted(records, taskId, date) {
  return records.get(recordKey(taskId, date))?.completed === true;
}

export function completionCount(records, date) {
  return TASKS.filter((task) => isCompleted(records, task.id, date)).length;
}

export function completionRate(records, date) {
  return completionCount(records, date) / TASKS.length;
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

export function overviewStats(records, monthKey = todayKey(), today = todayKey()) {
  const days = effectiveMonthRange(monthKey, today);
  const total = days.reduce((sum, date) => sum + completionCount(records, date), 0);
  return {
    greenDays: days.filter((date) => completionRate(records, date) >= 0.5).length,
    totalRate: days.length ? Math.round((total / (days.length * TASKS.length)) * 100) : 0,
    totalCheckins: total
  };
}

export function taskStats(records, taskId, monthKey = todayKey(), today = todayKey()) {
  const monthDays = effectiveMonthRange(monthKey, today);
  const monthCount = monthDays.filter((date) => isCompleted(records, taskId, date)).length;
  const currentStart = isCompleted(records, taskId, today) ? today : addDays(today, -1);
  let currentStreak = 0;
  if (currentStart >= EFFECTIVE_START_DATE && isCompleted(records, taskId, currentStart)) {
    for (let date = currentStart; date >= EFFECTIVE_START_DATE; date = addDays(date, -1)) {
      if (!isCompleted(records, taskId, date)) break;
      currentStreak += 1;
    }
  }
  let longestStreak = 0;
  let run = 0;
  for (const date of inclusiveDateKeys(EFFECTIVE_START_DATE, today)) {
    if (isCompleted(records, taskId, date)) {
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

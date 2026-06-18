import test from "node:test";
import assert from "node:assert/strict";
import {
  EFFECTIVE_START_DATE,
  TASKS,
  addDays,
  applyTaskOrder,
  completionCount,
  createDefaultTasks,
  hasCompletedRecord,
  isTaskActiveOn,
  monthGrid,
  moveTaskToHiddenEnd,
  moveTaskToVisibleEnd,
  overviewStats,
  recordKey,
  sortTasks,
  startOfWeek,
  tasksForDate,
  taskStats,
  upsertTaskVersion,
  validateUsername,
  weekKeys
} from "../src/domain.js";

function records(entries) {
  return new Map(entries.map(([taskId, date, completed = true]) => [
    recordKey(taskId, date),
    { taskId, date, completed }
  ]));
}

test("fixed effective start date is June 10", () => {
  assert.equal(EFFECTIVE_START_DATE, "2026-06-10");
});

test("week starts on Sunday", () => {
  assert.equal(startOfWeek("2026-06-15"), "2026-06-14");
  assert.deepEqual(weekKeys("2026-06-15"), [
    "2026-06-14", "2026-06-15", "2026-06-16", "2026-06-17",
    "2026-06-18", "2026-06-19", "2026-06-20"
  ]);
});

test("month grid always has six Sunday-first rows", () => {
  const grid = monthGrid("2026-06-01");
  assert.equal(grid.length, 42);
  assert.equal(grid[0].key, "2026-05-31");
  assert.equal(grid[1].key, "2026-06-01");
});

test("overview rounds display percentage and counts green days", () => {
  const map = records([
    [TASKS[0].id, "2026-06-10"],
    [TASKS[1].id, "2026-06-10"],
    [TASKS[0].id, "2026-06-11"]
  ]);
  const stats = overviewStats(map, "2026-06-01", "2026-06-11");
  assert.equal(stats.greenDays, 1);
  assert.equal(stats.totalCheckins, 3);
  assert.equal(stats.totalRate, 38);
});

test("current streak is zero when today and yesterday are incomplete", () => {
  const taskId = TASKS[0].id;
  const map = records([[taskId, "2026-06-12"], [taskId, "2026-06-13"]]);
  assert.equal(taskStats(map, taskId, "2026-06-01", "2026-06-15").currentStreak, 0);
});

test("current streak starts yesterday when today is incomplete", () => {
  const taskId = TASKS[0].id;
  const map = records([
    [taskId, "2026-06-12"],
    [taskId, "2026-06-13"],
    [taskId, "2026-06-14"]
  ]);
  assert.equal(taskStats(map, taskId, "2026-06-01", "2026-06-15").currentStreak, 3);
});

test("date addition crosses month correctly", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
});

test("new task only becomes active from created date", () => {
  const task = { id: "task_water", name: "喝水", color: "#00A6FB", createdDate: "2026-06-16", hiddenPeriods: [] };
  assert.equal(isTaskActiveOn(task, "2026-06-15"), false);
  assert.equal(isTaskActiveOn(task, "2026-06-16"), true);
});

test("hidden task is inactive during hidden period and active again after restore", () => {
  const task = {
    id: "task_water",
    name: "喝水",
    color: "#00A6FB",
    createdDate: "2026-06-10",
    hiddenPeriods: [{ start: "2026-06-16", end: "2026-06-18" }]
  };
  assert.equal(isTaskActiveOn(task, "2026-06-15"), true);
  assert.equal(isTaskActiveOn(task, "2026-06-16"), false);
  assert.equal(isTaskActiveOn(task, "2026-06-17"), false);
  assert.equal(isTaskActiveOn(task, "2026-06-18"), true);
});

test("hidden task is not counted in daily completion denominator", () => {
  const tasks = createDefaultTasks("2026-06-10");
  tasks[0].hiddenPeriods = [{ start: "2026-06-16", end: null }];
  const map = records([
    [tasks[0].id, "2026-06-16"],
    [tasks[1].id, "2026-06-16"]
  ]);
  assert.equal(completionCount(map, "2026-06-16", tasks), 1);
});

test("custom task order is preserved for cloud sort order", () => {
  const tasks = createDefaultTasks("2026-06-10");
  const reordered = applyTaskOrder(tasks, [
    tasks[2].id,
    tasks[0].id,
    tasks[1].id,
    tasks[3].id
  ]);
  assert.deepEqual(sortTasks(reordered).map((task) => task.id), [
    tasks[2].id,
    tasks[0].id,
    tasks[1].id,
    tasks[3].id
  ]);
});

test("hidden and restored tasks move to the end of their current section", () => {
  const tasks = createDefaultTasks("2026-06-10");
  tasks[1].hiddenPeriods = [{ start: "2026-06-16", end: null }];
  const hiddenLast = moveTaskToHiddenEnd(tasks, tasks[1].id);
  assert.deepEqual(sortTasks(hiddenLast).map((task) => task.id), [
    tasks[0].id,
    tasks[2].id,
    tasks[3].id,
    tasks[1].id
  ]);

  const restored = hiddenLast.map((task) => task.id === tasks[1].id
    ? { ...task, hiddenPeriods: [{ start: "2026-06-16", end: "2026-06-18" }] }
    : task);
  const visibleLast = moveTaskToVisibleEnd(restored, tasks[1].id);
  assert.deepEqual(sortTasks(visibleLast).map((task) => task.id), [
    tasks[0].id,
    tasks[2].id,
    tasks[3].id,
    tasks[1].id
  ]);
});

test("task edits only affect the effective date and later dates", () => {
  const tasks = createDefaultTasks("2026-06-10");
  const renamed = tasks.map((task) => task.id === tasks[0].id ? { ...task, name: "新名字" } : task);
  const versions = upsertTaskVersion([{ effectiveDate: "2026-06-10", tasks }], "2026-06-18", renamed);
  assert.equal(tasksForDate(versions, "2026-06-17")[0].name, tasks[0].name);
  assert.equal(tasksForDate(versions, "2026-06-18")[0].name, "新名字");
});

test("selected-date edits apply from that date until a newer version", () => {
  const tasks = createDefaultTasks("2026-06-10");
  const reorderedFrom16 = applyTaskOrder(tasks, [tasks[2].id, tasks[0].id, tasks[1].id, tasks[3].id]);
  const renamedFrom18 = reorderedFrom16.map((task) => task.id === tasks[2].id ? { ...task, name: "18号名字" } : task);
  const versions = upsertTaskVersion(
    upsertTaskVersion([{ effectiveDate: "2026-06-10", tasks }], "2026-06-16", reorderedFrom16),
    "2026-06-18",
    renamedFrom18
  );
  assert.deepEqual(sortTasks(tasksForDate(versions, "2026-06-15")).map((task) => task.id), tasks.map((task) => task.id));
  assert.deepEqual(sortTasks(tasksForDate(versions, "2026-06-16")).map((task) => task.id), [
    tasks[2].id,
    tasks[0].id,
    tasks[1].id,
    tasks[3].id
  ]);
  assert.equal(tasksForDate(versions, "2026-06-17")[0].name, tasks[2].name);
  assert.equal(tasksForDate(versions, "2026-06-18")[0].name, "18号名字");
});

test("restored task is visible at the end only from restore date", () => {
  const tasks = createDefaultTasks("2026-06-10");
  const hidden = moveTaskToHiddenEnd(tasks.map((task) => task.id === tasks[1].id
    ? { ...task, hiddenPeriods: [{ start: "2026-06-16", end: null }] }
    : task), tasks[1].id);
  const restored = moveTaskToVisibleEnd(hidden.map((task) => task.id === tasks[1].id
    ? { ...task, hiddenPeriods: [{ start: "2026-06-16", end: "2026-06-18" }] }
    : task), tasks[1].id);
  const versions = upsertTaskVersion(
    upsertTaskVersion([{ effectiveDate: "2026-06-10", tasks }], "2026-06-16", hidden),
    "2026-06-18",
    restored
  );
  assert.equal(isTaskActiveOn(tasksForDate(versions, "2026-06-17").find((task) => task.id === tasks[1].id), "2026-06-17"), false);
  assert.deepEqual(sortTasks(tasksForDate(versions, "2026-06-18")).map((task) => task.id), [
    tasks[0].id,
    tasks[2].id,
    tasks[3].id,
    tasks[1].id
  ]);
});

test("only completed true records block permanent delete", () => {
  const taskId = TASKS[0].id;
  assert.equal(hasCompletedRecord(records([[taskId, "2026-06-16", false]]), taskId), false);
  assert.equal(hasCompletedRecord(records([[taskId, "2026-06-16", true]]), taskId), true);
});

test("username validation accepts the v1.1 rule set", () => {
  assert.equal(validateUsername("ysw"), "");
  assert.equal(validateUsername("用户_01"), "");
  assert.equal(validateUsername("a"), "用户名需要 2 到 16 个字符");
  assert.equal(validateUsername("abc!"), "只能使用中文、英文、数字和下划线");
});

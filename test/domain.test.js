import test from "node:test";
import assert from "node:assert/strict";
import {
  EFFECTIVE_START_DATE,
  TASKS,
  addDays,
  monthGrid,
  overviewStats,
  recordKey,
  startOfWeek,
  taskStats,
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

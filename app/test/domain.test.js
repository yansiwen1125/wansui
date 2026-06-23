import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  EFFECTIVE_START_DATE,
  TASKS,
  addDays,
  applyTaskOrder,
  canViewReadingDate,
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
import { calculateAstrology, zodiacSign } from "../src/astrology.js";
import { generateDailyReading, normalizeDailyReading } from "../src/reading.js";

globalThis.Astronomy = {
  Body: {
    Sun: "Sun",
    Moon: "Moon",
    Mercury: "Mercury",
    Venus: "Venus",
    Mars: "Mars",
    Jupiter: "Jupiter",
    Saturn: "Saturn"
  },
  SunPosition(date) {
    return { elon: longitudeFor("Sun", date) };
  },
  EclipticGeoMoon(date) {
    return { elon: longitudeFor("Moon", date) };
  },
  GeoVector(body, date) {
    return { body, date };
  },
  Ecliptic(vector) {
    return { elon: longitudeFor(vector.body, vector.date) };
  }
};

function longitudeFor(body, date) {
  const daySeed = Math.floor(date.getTime() / 86400000);
  const bodySeed = String(body).split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return (daySeed * 13 + bodySeed * 17) % 360;
}

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

test("home reading starts from the saved profile date only", () => {
  assert.equal(canViewReadingDate("2026-06-17", "2026-06-18", "2026-06-19"), false);
  assert.equal(canViewReadingDate("2026-06-18", "2026-06-18", "2026-06-19"), true);
  assert.equal(canViewReadingDate("2026-06-20", "2026-06-18", "2026-06-19"), false);
  assert.equal(canViewReadingDate("2026-06-18", "", "2026-06-19"), false);
});

test("daily reading is stable for the same user and date", async () => {
  const profile = {
    username: "ysw",
    birthDate: "1998-08-08",
    birthTime: "08:30",
    birthCity: "上海"
  };
  const cards = [
    { id: "major-17-star", nameZh: "星星", nameEn: "The Star", image: "star.png" },
    { id: "major-14-temperance", nameZh: "节制", nameEn: "Temperance", image: "temperance.png" }
  ];
  const first = await generateDailyReading(profile, "2026-06-19", cards);
  const second = await generateDailyReading(profile, "2026-06-19", cards);
  assert.deepEqual(
    {
      score: first.score,
      goodTags: first.goodTags,
      cautionTags: first.cautionTags,
      luckyNumber: first.luckyNumber,
      luckyColor: first.luckyColor,
      tarot: first.tarot
    },
    {
      score: second.score,
      goodTags: second.goodTags,
      cautionTags: second.cautionTags,
      luckyNumber: second.luckyNumber,
      luckyColor: second.luckyColor,
      tarot: second.tarot
    }
  );
});

test("astronomy-engine path calculates zodiac positions and aspects", async () => {
  assert.equal(zodiacSign(0), "白羊");
  assert.equal(zodiacSign(359), "双鱼");
  const astrology = await calculateAstrology({
    birthDate: "1998-08-08",
    birthTime: "08:30",
    birthCity: "上海"
  }, "2026-06-19");
  assert.equal(astrology.source, "astronomy-engine");
  assert.equal(astrology.natal.length, 7);
  assert.equal(astrology.transit.length, 7);
  assert.ok(astrology.transit.some((item) => item.body === "sun" && item.sign));
});

test("daily reading includes astronomy-engine source data", async () => {
  const reading = await generateDailyReading({
    username: "ysw",
    birthDate: "1998-08-08",
    birthTime: "08:30",
    birthCity: "上海"
  }, "2026-06-19", []);
  assert.equal(reading.algorithmVersion, "v2.0-daily-variety");
  assert.equal(reading.astrology.source, "astronomy-engine");
  assert.ok(reading.astrology?.natal?.length);
  assert.ok(reading.astrology?.transit?.length);
  assert.ok(reading.astrologyText.includes("今日"));
});

test("daily reading varies across a week for the same profile", async () => {
  const profile = {
    username: "test1",
    birthDate: "1998-08-08",
    birthTime: "08:30",
    birthCity: "上海"
  };
  const dates = [
    "2026-06-21", "2026-06-22", "2026-06-23", "2026-06-24",
    "2026-06-25", "2026-06-26", "2026-06-27"
  ];
  const readings = await Promise.all(dates.map((date) => generateDailyReading(profile, date, [])));
  const scores = new Set(readings.map((reading) => reading.score));
  const summaries = new Set(readings.map((reading) => reading.summary));
  const tagSets = new Set(readings.map((reading) => [
    ...reading.goodTags,
    ...reading.cautionTags
  ].join("|")));

  assert.ok(scores.size >= 4);
  assert.ok(summaries.size >= 4);
  assert.ok(tagSets.size >= 5);
});

test("remote daily reading keeps structured lucky color from content", () => {
  const reading = normalizeDailyReading({
    username: "ysw",
    reading_date: "2026-06-19",
    fortune_score: 82,
    good_tags: ["整理"],
    caution_tags: ["过度承诺"],
    lucky_number: 7,
    lucky_color: "blue",
    astrology_key: "order",
    content: {
      luckyColor: { key: "brown", name: "棕色", value: "#A9795B" },
      summary: "今天适合收尾。",
      tarot: { id: "major-17-star" },
      astrologyText: "今日星盘提示。"
    },
    algorithm_version: "v2.0-astronomy-engine-copy"
  });
  assert.deepEqual(reading.luckyColor, { key: "brown", name: "棕色", value: "#A9795B" });
});

test("tarot copy covers all 78 cards", () => {
  const cards = JSON.parse(readFileSync("assets/tarot/cards.json", "utf8"));
  const copy = JSON.parse(readFileSync("assets/tarot/copy.json", "utf8"));
  assert.equal(cards.length, 78);
  for (const card of cards) {
    assert.ok(copy[card.id]?.upright?.keywords, `${card.id} upright missing`);
    assert.ok(copy[card.id]?.reversed?.keywords, `${card.id} reversed missing`);
  }
});

test("daily reading uses card-specific tarot copy", async () => {
  const reading = await generateDailyReading({
    username: "ysw",
    birthDate: "1998-08-08",
    birthTime: "08:30",
    birthCity: "上海"
  }, "2026-06-19", [{
    id: "major-17-star",
    nameZh: "星星",
    nameEn: "The Star",
    image: "star.png",
    meanings: {
      upright: {
        keywords: "专属关键词",
        overall: "专属整体",
        work: "专属工作",
        relationship: "专属关系",
        reminder: "专属提醒"
      },
      reversed: {
        keywords: "逆位关键词",
        overall: "逆位整体",
        work: "逆位工作",
        relationship: "逆位关系",
        reminder: "逆位提醒"
      }
    }
  }]);
  assert.ok(["专属关键词", "逆位关键词"].includes(reading.tarot.keywords));
});

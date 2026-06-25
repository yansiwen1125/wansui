import { astrologySummary, astrologyThemes, calculateAstrology } from "./astrology.js?v=2.1.1";

export const READING_ALGORITHM_VERSION = "v2.0-daily-variety";

const THEMES = [
  "completion", "order", "rest", "focus", "communication", "emotion",
  "relationship", "action", "creation", "reflection", "change", "patience"
];

const GOOD_TAGS = {
  completion: ["收尾", "完成旧事项", "补上缺口", "给阶段画句号"],
  order: ["整理", "重排优先级", "检查细节", "把散掉的东西收回来"],
  rest: ["恢复", "早点休息", "减少安排", "给身体空间"],
  focus: ["专注", "完成一件事", "减少干扰", "守住节奏"],
  communication: ["沟通确认", "写下来", "问清楚", "把误会讲开"],
  emotion: ["照顾感受", "慢慢消化", "诚实面对自己", "留一点缓冲"],
  relationship: ["温和表达", "确认边界", "认真倾听", "把关系放轻一点"],
  action: ["推进", "主动处理", "做明确决定", "先迈出小步"],
  creation: ["创作", "整理灵感", "做草稿", "允许不完美开始"],
  reflection: ["复盘", "独处", "回看线索", "把答案往内收"],
  change: ["调整", "换个角度", "轻量试错", "重新选择入口"],
  patience: ["等待", "稳住", "按步骤来", "让事情自然成熟"]
};

const CAUTION_TAGS = {
  completion: ["一边收尾一边开新坑", "为了完美迟迟不结束", "最后阶段松掉"],
  order: ["临时改计划", "越整理越焦虑", "重复检查"],
  rest: ["硬撑", "过度安排", "休息时还在自责"],
  focus: ["分心", "多线乱开", "把简单事复杂化"],
  communication: ["说太满", "默认别人懂", "听一半就回应"],
  emotion: ["被情绪带走", "在情绪高点决定", "反复内耗"],
  relationship: ["过度承诺", "害怕拒绝", "忽略自己的需要"],
  action: ["急着证明", "凭一口气决定", "忽略身体信号"],
  creation: ["只想开始不想完成", "灵感太散", "草稿未成形就否定"],
  reflection: ["钻牛角尖", "只想不做", "把复盘变成责备"],
  change: ["临时起意", "频繁推翻", "把不安当直觉"],
  patience: ["急于求成", "反复确认", "用焦虑推着自己走"]
};

const THEME_COPY = {
  completion: "今天适合把已经开始的事做完，不急着证明什么。",
  order: "把散掉的东西收回来，会比开启新计划更让你安心。",
  rest: "今天不是停滞，而是在给下一步留出恢复的空间。",
  focus: "把最重要的一件事收好，比同时推进很多事更有价值。",
  communication: "确认细节、写下来、再行动，会比凭感觉推进更顺。",
  emotion: "今天适合把感受放回重要的位置，不需要马上给所有事答案。",
  relationship: "关系里可以温柔一点，但也要记得把边界留给自己。",
  action: "可以主动一点，但要先确认方向，速度才不会变成消耗。",
  creation: "灵感会变多，但先选一个方向，不要被新鲜感带着跑。",
  reflection: "给自己一点安静，你会更容易分清感受和事实。",
  change: "变化出现时，先整理信息，不急着立刻做决定。",
  patience: "节奏慢一点没关系，今天的重点是稳和准。"
};

const ASTROLOGY_COPY = {
  completion: "土星主题提醒你回到秩序和责任。今天适合完成旧事、整理结构，而不是随手开新坑。",
  order: "今日月亮受到秩序主题影响，适合整理、负责和收尾。压力感可能变强，但也更容易把事情落地。",
  rest: "太阳与月亮的节奏更偏向回收能量。适合减少消耗，先把身体和情绪放回安全的位置。",
  focus: "水星主题较强，今天更适合确认、记录和学习。把重点写下来，会减少后面的反复。",
  communication: "沟通和判断会成为重点，越具体的表达越能减少误会。重要信息最好再确认一次。",
  emotion: "月亮主题较强，感受会比平时更明显。适合照顾情绪，不适合在情绪高点做承诺。",
  relationship: "金星主题较强，关系、舒适感和边界会更被看见。适合温和表达，也适合照顾自己的感受。",
  action: "火星主题较强，行动欲会上来，但也容易急。适合推进具体事项，不适合凭一口气做大决定。",
  creation: "金星和火星的表达感被激活，适合把模糊的灵感做成一个可见的小版本。",
  reflection: "月亮的内省感更明显，今天适合回看线索、整理原因，不必立刻给所有事一个结论。",
  change: "变化主题被点亮，适合观察新的入口。先小范围试错，不要马上推翻全部计划。",
  patience: "土星让今天更适合面对现实：把该补的补上，把该收的收好。慢一点反而更稳。"
};

const COLORS = [
  { key: "blue", name: "蓝色", value: "#82BDE3" },
  { key: "brown", name: "棕色", value: "#A9795B" },
  { key: "cream", name: "米白", value: "#EFEAE2" },
  { key: "red", name: "红色", value: "#EB5757" },
  { key: "yellow", name: "黄色", value: "#F3A712" },
  { key: "pink", name: "粉色", value: "#F299B7" },
  { key: "gray_blue", name: "灰蓝", value: "#4F5D75" },
  { key: "purple", name: "紫色", value: "#7B61FF" },
  { key: "deep_blue", name: "深蓝", value: "#315F8A" },
  { key: "orange", name: "橙色", value: "#FF8C42" }
];

const FALLBACK_SIGNS = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼"
];

function normalizeLuckyColor(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  return COLORS.find((color) => color.key === value || color.name === value)
    ?? { key: String(value), name: String(value), value: "#82BDE3" };
}

const TAROT_THEME_MAP = {
  completion: ["major-21-world", "pentacles-10-ten", "wands-14-king", "swords-13-queen"],
  order: ["major-04-emperor", "major-11-justice", "pentacles-08-eight", "swords-14-king"],
  rest: ["major-14-temperance", "cups-04-four", "cups-09-nine", "swords-04-four"],
  focus: ["major-01-magician", "swords-01-ace", "pentacles-08-eight", "swords-14-king"],
  communication: ["major-06-lovers", "swords-01-ace", "wands-11-page", "cups-11-page"],
  emotion: ["major-18-moon", "cups-01-ace", "cups-13-queen", "cups-07-seven"],
  relationship: ["major-06-lovers", "cups-02-two", "cups-10-ten", "pentacles-06-six"],
  action: ["major-07-chariot", "wands-01-ace", "wands-08-eight", "swords-06-six"],
  creation: ["major-03-empress", "wands-01-ace", "cups-11-page", "wands-13-queen"],
  reflection: ["major-09-hermit", "major-12-hanged-man", "swords-02-two", "cups-12-knight"],
  change: ["major-10-wheel-of-fortune", "major-13-death", "wands-02-two", "swords-06-six"],
  patience: ["major-14-temperance", "pentacles-07-seven", "swords-04-four", "pentacles-12-knight"]
};

const TAROT_FALLBACK = {
  upright: {
    keywords: "希望 / 恢复 / 继续相信",
    overall: "这张牌正位时，更像一个提醒：你不需要马上看见全部结果，只要确认自己仍在恢复和前进的路上。今天适合把注意力放回那些真正让你稳定下来的事。",
    work: "工作学习上，适合稳稳推进已经开始的任务。不要急着开太多新计划，先把手上的线索接起来。",
    relationship: "关系情绪里，适合温和表达真实感受。你可以给别人空间，也给自己一点恢复的空间。",
    reminder: "今天的提醒是：希望不是突然变好，而是你愿意继续照顾自己、继续往前。"
  },
  reversed: {
    keywords: "疲惫 / 怀疑 / 需要修复",
    overall: "这张牌逆位时，提示能量还没有完全恢复。你可能会怀疑自己是不是走得太慢，但今天更重要的是先把消耗降下来。",
    work: "工作学习上，别用过度证明换安全感。先完成必要部分，再考虑额外加码。",
    relationship: "关系情绪里，适合诚实承认疲惫，不要为了让气氛好看而答应太多。",
    reminder: "今天的提醒是：先修复，再推进。慢一点并不等于失败。"
  }
};

function hashString(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(array, seed, offset = 0) {
  if (!array.length) return null;
  return array[(seed + offset) % array.length];
}

function unique(items) {
  return [...new Set(items)].filter(Boolean);
}

function birthNumber(profile) {
  return String(profile.birthDate ?? "").replace(/\D/g, "").split("").reduce((sum, item) => sum + Number(item), 0);
}

function fallbackProfileThemes(profile, date) {
  const seed = hashString(`${profile.username}|${profile.birthDate}|${profile.birthTime}|${profile.birthCity}|${date}`);
  const base = birthNumber(profile);
  return unique([
    THEMES[base % THEMES.length],
    THEMES[(base + fromDate(date).getDay()) % THEMES.length],
    THEMES[seed % THEMES.length]
  ]);
}

function fromDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function mixedThemes(astrology, profile, date, seed) {
  const astroThemes = astrologyThemes(astrology);
  const profileThemes = fallbackProfileThemes(profile, date);
  const candidates = unique([
    astroThemes[seed % Math.max(astroThemes.length, 1)],
    profileThemes[0],
    astroThemes[0],
    profileThemes[1],
    astroThemes[1],
    profileThemes[2],
    astroThemes[2]
  ]);
  return candidates.slice(0, 3);
}

function tagsFor(theme, source, seed, count, offset = 0) {
  const tags = source[theme] ?? [];
  return Array.from({ length: count }, (_, index) => pick(tags, seed, offset + index));
}

function scoreFromAstrology(seed, themes, astrology) {
  const rawAspectScore = astrology.aspects.reduce((sum, aspect) => sum + aspect.weight, 0);
  const aspectScore = Math.max(-8, Math.min(8, Math.round(rawAspectScore * 0.7)));
  const dailySwing = (seed % 17) - 8;
  const themeScore = themes.includes("completion") || themes.includes("focus") ? 3 : 0;
  const softness = themes.includes("rest") || themes.includes("emotion") ? -3 : 0;
  return Math.max(48, Math.min(94, 74 + dailySwing + aspectScore + themeScore + softness));
}

function fallbackAstrology(profile, date, seed) {
  const base = birthNumber(profile);
  const day = fromDate(date).getDay();
  const natal = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn"].map((body, index) => ({
    body,
    longitude: (seed + base * (index + 3) + index * 37) % 360,
    sign: FALLBACK_SIGNS[(base + index * 2) % FALLBACK_SIGNS.length]
  }));
  const transit = natal.map((item, index) => ({
    body: item.body,
    longitude: (seed + day * 41 + index * 29) % 360,
    sign: FALLBACK_SIGNS[(day + index * 3 + seed) % FALLBACK_SIGNS.length]
  }));
  return {
    source: "local-fallback",
    natal,
    transit,
    aspects: []
  };
}

function tarotCopy(card, orientation, themes) {
  if (card?.meanings?.[orientation]) return card.meanings[orientation];
  const fallback = TAROT_FALLBACK[orientation];
  const name = card?.nameZh ?? "星星";
  const theme = themes[0] ?? "completion";
  return {
    keywords: fallback.keywords,
    overall: `${name}${orientation === "upright" ? "正位" : "逆位"}和今天的“${GOOD_TAGS[theme][0]}”主题相连。${fallback.overall}`,
    work: fallback.work,
    relationship: fallback.relationship,
    reminder: fallback.reminder
  };
}

export function normalizeDailyReading(row) {
  if (!row) return null;
  const content = row.content ?? {};
  const luckyColor = normalizeLuckyColor(row.luckyColor ?? content.luckyColor ?? row.lucky_color);
  return {
    username: row.username,
    date: row.date ?? row.reading_date,
    score: row.score ?? row.fortune_score,
    goodTags: row.goodTags ?? row.good_tags ?? [],
    cautionTags: row.cautionTags ?? row.caution_tags ?? [],
    luckyNumber: row.luckyNumber ?? row.lucky_number,
    luckyColor,
    astrologyKey: row.astrologyKey ?? row.astrology_key,
    astrologyText: row.astrologyText ?? content.astrologyText,
    astrology: row.astrology ?? content.astrology,
    summary: row.summary ?? content.summary,
    themes: row.themes ?? content.themes ?? [],
    tarot: row.tarot ?? content.tarot ?? null,
    algorithmVersion: row.algorithmVersion ?? row.algorithm_version ?? "v2.0-local",
    createdAt: row.createdAt ?? row.created_at,
    updatedAt: row.updatedAt ?? row.updated_at
  };
}

export async function generateDailyReading(profile, date, cards = []) {
  const seed = hashString(`${profile.username}|${profile.birthDate}|${profile.birthTime}|${profile.birthCity}|${date}|v2`);
  let astrology;
  try {
    astrology = await calculateAstrology(profile, date);
  } catch (error) {
    console.warn("astrology fallback used", error);
    astrology = fallbackAstrology(profile, date, seed);
  }
  const themes = mixedThemes(astrology, profile, date, seed);
  const mainTheme = themes[(seed + fromDate(date).getDay()) % themes.length] ?? themes[0];
  const goodTags = unique(themes.flatMap((theme, index) => tagsFor(theme, GOOD_TAGS, seed, 2, index))).slice(0, 4);
  const cautionTags = unique(themes.flatMap((theme, index) => tagsFor(theme, CAUTION_TAGS, seed, 1, index))).slice(0, 3);
  const weightedIds = unique(themes.flatMap((theme) => TAROT_THEME_MAP[theme] ?? []));
  const card = cards.find((item) => item.id === pick(weightedIds, seed)) ?? pick(cards, seed) ?? {
    id: "major-17-star",
    nameZh: "星星",
    image: "assets/tarot/cards/major-17-star.png"
  };
  const orientation = seed % 4 === 0 ? "reversed" : "upright";
  const luckyColor = COLORS[(seed + birthNumber(profile)) % COLORS.length];
  const reading = {
    username: profile.username,
    date,
    score: scoreFromAstrology(seed, themes, astrology),
    goodTags,
    cautionTags,
    luckyNumber: (seed % 9) + 1,
    luckyColor,
    astrologyKey: mainTheme,
    astrologyText: astrologySummary(astrology) || ASTROLOGY_COPY[mainTheme],
    summary: THEME_COPY[mainTheme],
    themes,
    astrology: {
      natal: astrology.natal,
      transit: astrology.transit,
      source: astrology.source,
      aspects: astrology.aspects
    },
    tarot: {
      id: card.id,
      nameZh: card.nameZh,
      nameEn: card.nameEn,
      image: card.image,
      orientation,
      orientationLabel: orientation === "upright" ? "正位" : "逆位",
      ...tarotCopy(card, orientation, themes)
    },
    algorithmVersion: READING_ALGORITHM_VERSION,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return normalizeDailyReading(reading);
}

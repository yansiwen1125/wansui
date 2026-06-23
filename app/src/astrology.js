const ZODIAC = [
  "白羊", "金牛", "双子", "巨蟹", "狮子", "处女",
  "天秤", "天蝎", "射手", "摩羯", "水瓶", "双鱼"
];

const BODY_THEME = {
  sun: "action",
  moon: "emotion",
  mercury: "communication",
  venus: "relationship",
  mars: "action",
  jupiter: "creation",
  saturn: "completion"
};

const SIGN_THEMES = {
  白羊: ["action", "creation"],
  金牛: ["order", "patience"],
  双子: ["communication", "change"],
  巨蟹: ["emotion", "relationship"],
  狮子: ["creation", "action"],
  处女: ["order", "focus"],
  天秤: ["relationship", "communication"],
  天蝎: ["reflection", "emotion"],
  射手: ["change", "action"],
  摩羯: ["focus", "completion"],
  水瓶: ["change", "creation"],
  双鱼: ["emotion", "reflection"]
};

const BODY_MAP = {
  sun: "Sun",
  moon: "Moon",
  mercury: "Mercury",
  venus: "Venus",
  mars: "Mars",
  jupiter: "Jupiter",
  saturn: "Saturn"
};

const ASPECTS = [
  { name: "合相", angle: 0, orb: 8, theme: "focus", weight: 3 },
  { name: "六合", angle: 60, orb: 5, theme: "communication", weight: 2 },
  { name: "刑相", angle: 90, orb: 6, theme: "change", weight: -2 },
  { name: "拱相", angle: 120, orb: 6, theme: "flow", weight: 3 },
  { name: "冲相", angle: 180, orb: 7, theme: "reflection", weight: -2 }
];

const ASTRONOMY_ENGINE_URL = "https://cdn.jsdelivr.net/gh/cosinekitty/astronomy@master/source/js/astronomy.browser.min.js";
let astronomyPromise = null;

function normalizeDegree(value) {
  return ((value % 360) + 360) % 360;
}

function timeZoneOffsetMinutes(date, timeZone) {
  if (!timeZone) return 0;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  const zonedAsUtc = Date.UTC(values.year, values.month - 1, values.day, values.hour, values.minute, values.second);
  return (zonedAsUtc - date.getTime()) / 60000;
}

function dateTimeToUtcDate(dateKey, time = "12:00", timeZone = "UTC") {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour = 12, minute = 0] = String(time || "12:00").split(":").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstPass = new Date(localAsUtc - timeZoneOffsetMinutes(new Date(localAsUtc), timeZone) * 60000);
  const secondOffset = timeZoneOffsetMinutes(firstPass, timeZone);
  return new Date(localAsUtc - secondOffset * 60000);
}

function bodyConstant(astronomy, body) {
  return astronomy.Body?.[BODY_MAP[body]] ?? BODY_MAP[body];
}

function requireAstronomyApi(astronomy) {
  if (!astronomy?.Body || !astronomy?.GeoVector || !astronomy?.Ecliptic || !astronomy?.SunPosition || !astronomy?.EclipticGeoMoon) {
    throw new Error("真实星历库未正确加载");
  }
  return astronomy;
}

export async function loadAstronomyEngine() {
  if (globalThis.Astronomy) return requireAstronomyApi(globalThis.Astronomy);
  if (typeof document === "undefined") {
    throw new Error("真实星历库未加载：当前环境没有浏览器脚本加载能力");
  }
  if (!astronomyPromise) {
    astronomyPromise = new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-astronomy-engine]");
      if (existing) {
        existing.addEventListener("load", () => resolve(requireAstronomyApi(globalThis.Astronomy)), { once: true });
        existing.addEventListener("error", () => reject(new Error("真实星盘库加载失败，请稍后重试")), { once: true });
        return;
      }
      const script = document.createElement("script");
      script.src = ASTRONOMY_ENGINE_URL;
      script.async = true;
      script.dataset.astronomyEngine = "true";
      script.onload = () => resolve(requireAstronomyApi(globalThis.Astronomy));
      script.onerror = () => reject(new Error("真实星盘库加载失败，请稍后重试"));
      document.head.appendChild(script);
    });
  }
  return astronomyPromise;
}

function geocentricLongitude(astronomy, body, time) {
  if (body === "sun") return normalizeDegree(astronomy.SunPosition(time).elon);
  if (body === "moon") return normalizeDegree(astronomy.EclipticGeoMoon(time).elon);
  const vector = astronomy.GeoVector(bodyConstant(astronomy, body), time, true);
  return normalizeDegree(astronomy.Ecliptic(vector).elon);
}

function bodyEntries(astronomy, dateKey, timeText, timeZone) {
  const time = dateTimeToUtcDate(dateKey, timeText, timeZone);
  return Object.keys(BODY_MAP).map((body) => {
    const longitude = geocentricLongitude(astronomy, body, time);
    return {
      body,
      longitude,
      sign: zodiacSign(longitude)
    };
  });
}

export function zodiacSign(longitude) {
  return ZODIAC[Math.floor(normalizeDegree(longitude) / 30)];
}

function angularDistance(a, b) {
  const distance = Math.abs(normalizeDegree(a) - normalizeDegree(b));
  return distance > 180 ? 360 - distance : distance;
}

function aspectBetween(transit, natal) {
  const distance = angularDistance(transit.longitude, natal.longitude);
  const aspect = ASPECTS.find((item) => Math.abs(distance - item.angle) <= item.orb);
  if (!aspect) return null;
  return {
    name: aspect.name,
    transitBody: transit.body,
    natalBody: natal.body,
    distance: Math.round(distance),
    theme: aspect.theme === "flow" ? (BODY_THEME[transit.body] ?? "focus") : aspect.theme,
    weight: aspect.weight
  };
}

export async function calculateAstrology(profile, date) {
  const astronomy = await loadAstronomyEngine();
  const birthTime = profile.birthTimeUnknown ? "12:00" : (profile.birthTime || "12:00");
  const birthTimeZone = profile.birthTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const currentTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const natal = bodyEntries(astronomy, profile.birthDate, birthTime, birthTimeZone);
  const transit = bodyEntries(astronomy, date, "12:00", currentTimeZone);
  const aspects = transit.flatMap((transitBody) => (
    natal.map((natalBody) => aspectBetween(transitBody, natalBody)).filter(Boolean)
  ));
  return {
    source: "astronomy-engine",
    natal,
    transit,
    aspects: aspects
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, 10)
  };
}

export function astrologyThemes(astrology) {
  const scores = new Map();
  const add = (theme, amount = 1) => scores.set(theme, (scores.get(theme) ?? 0) + amount);
  astrology.natal.forEach((item) => {
    (SIGN_THEMES[item.sign] ?? []).forEach((theme) => add(theme, item.body === "sun" ? 2 : 1));
  });
  astrology.transit.forEach((item) => {
    (SIGN_THEMES[item.sign] ?? []).forEach((theme) => add(theme, item.body === "moon" ? 2 : 1));
  });
  astrology.aspects.forEach((aspect) => add(aspect.theme, aspect.weight));
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([theme]) => theme)
    .slice(0, 3);
}

export function astrologySummary(astrology) {
  const strongest = astrology.aspects[0];
  const moon = astrology.transit.find((item) => item.body === "moon");
  const sun = astrology.transit.find((item) => item.body === "sun");
  if (strongest) {
    return `今日${bodyName(strongest.transitBody)}与本命${bodyName(strongest.natalBody)}形成${strongest.name}，同时月亮落在${moon?.sign ?? "当前"}主题里。今天的重点会更容易落到${themeName(strongest.theme)}上。`;
  }
  return `今日太阳落在${sun?.sign ?? "当前"}，月亮落在${moon?.sign ?? "当前"}。整体节奏更适合顺着当天能量做选择，而不是强行和自己较劲。`;
}

function bodyName(body) {
  return {
    sun: "太阳",
    moon: "月亮",
    mercury: "水星",
    venus: "金星",
    mars: "火星",
    jupiter: "木星",
    saturn: "土星"
  }[body] ?? body;
}

function themeName(theme) {
  return {
    action: "行动和推进",
    order: "秩序和整理",
    rest: "休息和恢复",
    focus: "专注和判断",
    communication: "沟通和确认",
    emotion: "情绪和感受",
    relationship: "关系和边界",
    creation: "表达和创造",
    reflection: "复盘和内省",
    change: "变化和调整",
    completion: "收尾和完成",
    patience: "耐心和稳定"
  }[theme] ?? theme;
}

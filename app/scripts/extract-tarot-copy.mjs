import { readFile, writeFile } from "node:fs/promises";

const cards = JSON.parse(await readFile("assets/tarot/cards.json", "utf8"));
const markdown = await readFile("../docs/versions/v2.0/content/COPY_LIBRARY.md", "utf8");

const fieldMap = {
  "关键词": "keywords",
  "整体能量": "overall",
  "工作学习": "work",
  "关系情绪": "relationship",
  "今日提醒": "reminder"
};

const copy = {};
const cardBlocks = markdown
  .split(/\n(?=### [^\n]+（[^\n]+）)/)
  .filter((block) => block.startsWith("### "));

for (const block of cardBlocks) {
  const title = block.match(/^###\s+(.+?)（(.+?)）/);
  if (!title) continue;
  const [, nameZh] = title;
  const card = cards.find((item) => item.nameZh === nameZh);
  if (!card) continue;
  const meanings = {};
  const orientationBlocks = block.split(/\n(?=#### )/).slice(1);
  for (const orientationBlock of orientationBlocks) {
    const orientationTitle = orientationBlock.match(/^####\s+(正位|逆位)/);
    if (!orientationTitle) continue;
    const orientation = orientationTitle[1] === "正位" ? "upright" : "reversed";
    meanings[orientation] = {};
    for (const line of orientationBlock.split("\n")) {
      const match = line.match(/^-\s+(关键词|整体能量|工作学习|关系情绪|今日提醒)：(.+)$/);
      if (!match) continue;
      const key = fieldMap[match[1]];
      meanings[orientation][key] = match[2].replace(/^今日提醒：/, "").trim();
    }
  }
  copy[card.id] = meanings;
}

const missing = cards.filter((card) => {
  const meanings = copy[card.id];
  return !meanings?.upright?.keywords
    || !meanings?.upright?.overall
    || !meanings?.upright?.work
    || !meanings?.upright?.relationship
    || !meanings?.upright?.reminder
    || !meanings?.reversed?.keywords
    || !meanings?.reversed?.overall
    || !meanings?.reversed?.work
    || !meanings?.reversed?.relationship
    || !meanings?.reversed?.reminder;
});

if (missing.length) {
  throw new Error(`Missing tarot copy: ${missing.map((card) => card.id).join(", ")}`);
}

await writeFile("assets/tarot/copy.json", `${JSON.stringify(copy, null, 2)}\n`);
console.log(`Extracted tarot copy for ${Object.keys(copy).length} cards.`);

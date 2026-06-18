import { cp, mkdir, rm } from "node:fs/promises";

const files = [
  "index.html",
  "cloud-debug.html",
  "safari-reset.html",
  "config.js",
  "manifest.webmanifest",
  "sw.js",
  "src",
  "icons"
];

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
for (const file of files) {
  await cp(file, `dist/${file}`, { recursive: true });
}
console.log("Built dist/");

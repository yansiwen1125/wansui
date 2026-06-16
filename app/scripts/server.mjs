import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve } from "node:path";

const root = resolve(process.argv[2] ?? ".");
const port = Number(process.env.PORT ?? 4173);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml"
};

createServer((request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  let path = join(root, decodeURIComponent(url.pathname));
  if (url.pathname === "/" || !existsSync(path)) path = join(root, "index.html");
  if (existsSync(path) && statSync(path).isDirectory()) path = join(path, "index.html");
  response.setHeader("Content-Type", mime[extname(path)] ?? "application/octet-stream");
  response.setHeader("Cache-Control", "no-cache");
  createReadStream(path).on("error", () => {
    response.statusCode = 404;
    response.end("Not found");
  }).pipe(response);
}).listen(port, "127.0.0.1", () => {
  console.log(`万岁 running at http://127.0.0.1:${port}`);
});

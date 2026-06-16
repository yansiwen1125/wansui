import { deflateSync } from "node:zlib";
import { mkdir, writeFile } from "node:fs/promises";

const palette = ["#A9795B", "#315F8A", "#82BDE3", "#7FB77E"];
const background = "#FAF9F6";

function rgb(hex) {
  return [
    Number.parseInt(hex.slice(1, 3), 16),
    Number.parseInt(hex.slice(3, 5), 16),
    Number.parseInt(hex.slice(5, 7), 16),
  ];
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

function insideRoundedRect(x, y, left, top, size, radius) {
  const right = left + size;
  const bottom = top + size;
  const nearestX = Math.max(left + radius, Math.min(x, right - radius));
  const nearestY = Math.max(top + radius, Math.min(y, bottom - radius));
  return (x - nearestX) ** 2 + (y - nearestY) ** 2 <= radius ** 2;
}

function createIcon(size) {
  const pixels = Buffer.alloc(size * (size * 4 + 1));
  const bg = rgb(background);
  const margin = Math.round(size * 0.18);
  const gap = Math.round(size * 0.095);
  const block = Math.round((size - margin * 2 - gap) / 2);
  const radius = Math.round(block * 0.24);

  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    pixels[row] = 0;
    for (let x = 0; x < size; x += 1) {
      let color = bg;
      const positions = [
        [margin, margin],
        [margin + block + gap, margin],
        [margin, margin + block + gap],
        [margin + block + gap, margin + block + gap],
      ];
      positions.forEach(([left, top], index) => {
        if (insideRoundedRect(x, y, left, top, block, radius)) {
          color = rgb(palette[index]);
        }
      });
      const offset = row + 1 + x * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await mkdir(new URL("../icons", import.meta.url), { recursive: true });
await Promise.all([
  writeFile(new URL("../icons/apple-touch-icon.png", import.meta.url), createIcon(180)),
  writeFile(new URL("../icons/icon-192.png", import.meta.url), createIcon(192)),
  writeFile(new URL("../icons/icon-512.png", import.meta.url), createIcon(512)),
]);

console.log("Generated app icons.");

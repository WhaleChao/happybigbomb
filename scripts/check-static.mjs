// 檢查建置產物是否完全靜態：不得引用任何外部網址（CDN、字型、API）。
// 只允許不會被實際請求的字串（SVG 命名空間、React 錯誤說明連結）。
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const DIST = process.argv[2] ?? 'dist';
const ALLOWED = [/^https?:\/\/www\.w3\.org\//, /^https:\/\/react\.dev\/errors\//];

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(p);
    else if (/\.(html|js|css|json|webmanifest)$/.test(entry.name)) yield p;
  }
}

const problems = [];
for await (const file of walk(DIST)) {
  const text = await readFile(file, 'utf8');
  for (const m of text.matchAll(/https?:\/\/[^\s"'`)<>]+/g)) {
    if (!ALLOWED.some((re) => re.test(m[0]))) problems.push(`${file}: ${m[0]}`);
  }
}

if (problems.length) {
  console.error('建置產物引用了外部網址：\n' + problems.join('\n'));
  process.exit(1);
}
console.log(`✓ ${DIST} 沒有引用任何外部網址`);
